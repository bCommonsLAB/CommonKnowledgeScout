"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { loadTemplateConfig } from "@/lib/templates/template-service-client"
import type { TemplateDocument, CreationSource, CreationSourceType } from "@/lib/templates/template-types"
import { CollectSourceStep } from "./steps/collect-source-step"
import { GenerateDraftStep } from "./steps/generate-draft-step"
import { EditDraftStep } from "./steps/edit-draft-step"
import { WelcomeStep } from "./steps/welcome-step"
import { PreviewDetailStep } from "./steps/preview-detail-step"
import { UploadImagesStep } from "./steps/upload-images-step"
import { SelectRelatedTestimonialsStep } from "./steps/select-related-testimonials-step"
import { ReviewMarkdownStep } from "./steps/review-markdown-step"
import { PublishStep } from "./steps/publish-step"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useStorage } from "@/contexts/storage-context"
import { useRouter } from "next/navigation"
import { useAtomValue } from "jotai"
import { currentFolderIdAtom } from "@/atoms/library-atom"
import { buildCreationFileName } from "@/lib/creation/file-name"
import { applyEventFrontmatterDefaults } from "@/lib/events/event-frontmatter-defaults"
import type { WizardSource } from "@/lib/creation/corpus"
import { buildCorpusText, isCorpusTooLarge, truncateCorpus } from "@/lib/creation/corpus"
import { parseFrontmatter } from "@/lib/markdown/frontmatter"
import { resolveArtifactClient } from "@/lib/shadow-twin/artifact-client"
import { writeArtifact } from "@/lib/shadow-twin/artifact-writer"
import { findRelatedTestimonials } from "@/lib/creation/dialograum-discovery"
import { findRelatedEventTestimonialsFilesystem } from "@/lib/creation/event-testimonial-discovery"
import { promoteWizardArtifacts } from "@/lib/creation/wizard-artifact-promotion"
import { useUser } from "@clerk/nextjs"
import type { WizardSessionEvent } from "@/types/wizard-session"
import {
  createWizardSessionClient,
  logWizardEventClient,
  addJobIdToSessionClient,
  finalizeWizardSessionClient,
  getFilePathsClient,
  getUserIdentifierClient,
} from "@/lib/wizard-session-logger-client"

declare global {
  interface Window {
    /**
     * Temporäre Brücke: `CollectSourceStep` legt hier eine Funktion ab,
     * damit der Wizard beim Klick auf „Weiter“ den aktuellen Input als Quelle übernehmen kann.
     */
    __collectSourceStepBeforeLeave?: () => WizardSource | null
  }
}

function nowMs(): number {
  return Date.now()
}

interface WizardState {
  currentStepIndex: number
  mode?: 'interview' | 'form' // Eingabemodus (wird im Briefing-Step gewählt)
  selectedSource?: CreationSource
  // Multi-Source: Liste aller Quellen
  sources: WizardSource[]
  // Legacy: collectedInput (wird schrittweise durch sources ersetzt)
  collectedInput?: {
    type: CreationSourceType
    content: string
  }
  generatedDraft?: {
    metadata: Record<string, unknown>
    markdown: string
  }
  reviewedFields?: Record<string, unknown>
  // Form-Modus: direkte Bearbeitung
  draftMetadata?: Record<string, unknown>
  draftText?: string
  // Loading-State für Re-Extract
  isExtracting?: boolean
  // PDF HITL: Progress-Anzeige für Jobs (Extract/Template/Ingest)
  processingProgress?: number
  processingMessage?: string
  // PDF HITL: finaler Publish-Schritt (User sieht Publizieren explizit)
  isPublishing?: boolean
  publishingProgress?: number
  publishingMessage?: string
  publishError?: string
  isPublished?: boolean
  /** Optional: Kurze Abschluss-Statistiken (für Publish-Step) */
  publishStats?: { documents: number; images: number; sources: number }
  /** Optional: Zielordner für "Im Explorer öffnen" */
  publishTargetFolderId?: string
  /** Optional: Ziel-Slug für "Im Explorer öffnen" (Gallery) */
  publishTargetSlug?: string
  // PDF HITL: Tracking
  pdfBaseFileId?: string
  pdfTranscriptFileId?: string
  /** Parent-Folder der Transcript-Datei (wichtig für MarkdownPreview: relative Images auflösen) */
  pdfTranscriptFolderId?: string
  pdfTransformFileId?: string
  hasConfirmedMarkdown?: boolean
  // Human-in-the-loop: Quellen-Bestätigung
  hasConfirmedSources?: boolean
  extractionError?: string
  // Bild-Upload: ausgewählte Dateien pro Bildfeld-Key
  imageFiles?: Record<string, File | null>
  // Bild-URLs: bereits hochgeladene URLs pro Bildfeld-Key (für Preview)
  imageUrls?: Record<string, string>
  // Upload-State: welche Bilder gerade hochgeladen werden
  isUploadingImages?: Record<string, boolean>
}

interface CreationWizardProps {
  typeId: string
  templateId: string
  libraryId: string
  /** Optional: File-ID zum Wiederaufnehmen einer bestehenden Datei */
  resumeFileId?: string
  /** Optional: File-ID zum Starten mit einer Seed-Datei (z.B. Dialograum für Dialograum-Ergebnis) */
  seedFileId?: string
  /** Optional: Zielordner (base64 fileId), falls Wizard explizit in einem Ordner gestartet wird */
  targetFolderId?: string
}

export function CreationWizard({ typeId, templateId, libraryId, resumeFileId, seedFileId, targetFolderId: targetFolderIdProp }: CreationWizardProps) {
  const [template, setTemplate] = useState<TemplateDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStepIndex: 0,
    sources: [],
  })
  // CollectSourceStep lebt lokal; dieser State dient nur dazu, den Parent neu zu rendern,
  // damit der "Weiter"-Button enabled/disabled korrekt aktualisiert.
  const [collectSourceCanProceed, setCollectSourceCanProceed] = useState(false)
  
  // Speichere resumeFileId und seedFileId im State für späteren Zugriff beim Speichern
  const [resumeFileIdState] = useState<string | undefined>(resumeFileId)
  const [seedFileIdState, setSeedFileIdState] = useState<string | undefined>(seedFileId)
  const { provider, refreshItems } = useStorage()
  const currentFolderIdAtomValue = useAtomValue(currentFolderIdAtom)
  // Verwende targetFolderIdProp, falls gesetzt (für Child-Flows), sonst currentFolderIdAtom
  const currentFolderId = targetFolderIdProp || currentFolderIdAtomValue
  const router = useRouter()

  // WICHTIG: Stabilisiere Callback für Testimonial-Auswahl, um Endlosschleifen zu vermeiden
  const handleTestimonialSelectionChange = useCallback((selectedSources: WizardSource[]) => {
    // Aktualisiere Sources: Dialograum bleibt, Testimonials werden gefiltert
    setWizardState(prev => {
      const dialograumSource = prev.sources.find(s => 
        s.kind === 'file' && 
        s.fileName && 
        s.fileName.toLowerCase().includes('dialograum')
      )
      const updatedSources = dialograumSource 
        ? [dialograumSource, ...selectedSources]
        : selectedSources
      
      // Nur aktualisieren, wenn sich die Sources tatsächlich geändert haben
      const currentIds = prev.sources.map(s => s.id).sort().join(',')
      const newIds = updatedSources.map(s => s.id).sort().join(',')
      if (currentIds === newIds) {
        return prev // Keine Änderung, State unverändert zurückgeben
      }
      
      return {
        ...prev,
        sources: updatedSources,
      }
    })
  }, []) // Leere Dependencies, da wir setWizardState verwenden (funktional update)

  function resolveTemplateDetailViewType(): 'book' | 'session' | 'testimonial' | 'blog' {
    // SSOT: Template-Detailansicht (im Template-Editor Tab "Detail-Ansicht")
    const metaDvt = template?.metadata?.detailViewType
    if (metaDvt === 'book' || metaDvt === 'session' || metaDvt === 'testimonial' || metaDvt === 'blog') return metaDvt
    // Backward compatibility: ältere Templates hatten teils `creation.preview.detailViewType`
    const legacy = template?.creation?.preview?.detailViewType
    if (legacy === 'book' || legacy === 'session' || legacy === 'testimonial' || legacy === 'blog') return legacy
    return 'session'
  }
  
  // Wizard Session Logging (DSGVO-konform)
  const { user } = useUser()
  const wizardSessionIdRef = useRef<string | null>(null)
  const userIdentifierRef = useRef<ReturnType<typeof getUserIdentifierClient> | null>(null)
  const wizardSessionCompletedRef = useRef(false)
  const latestStepIndexRef = useRef<number>(0)
  const metadataLogTimerRef = useRef<number | null>(null)
  const lastLoggedMetadataKeysHashRef = useRef<string>("")

  /**
   * Einheitliche Logging-Funktion (damit Call-Sites stabil bleiben).
   * Logging ist best-effort und darf den Wizard nicht blockieren.
   */
  async function logWizardEvent(
    sessionId: string,
    event: Omit<WizardSessionEvent, 'eventId' | 'timestamp'>
  ): Promise<void> {
    await logWizardEventClient(sessionId, event)
  }

  /**
   * Pfade best-effort: Für den Filesystem-Provider sind IDs häufig Base64-kodierte Pfade.
   * Wir speichern nur diese abgeleiteten Pfade (keine Inhalte).
   */
  async function getFilePaths(
    _provider: unknown,
    fileIds: { baseFileId?: string; transcriptFileId?: string; transformFileId?: string; savedItemId?: string }
  ): Promise<{ basePath?: string; transcriptPath?: string; transformPath?: string; savedPath?: string }> {
    return getFilePathsClient(fileIds)
  }

  async function promotePdfWizardArtifacts(args: { destinationFolderId: string }) {
    const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
    if (!isPdfAnalyse) return
    if (!provider) return
    if (!wizardState.pdfBaseFileId) return

    try {
      const res = await promoteWizardArtifacts({
        provider,
        baseFileId: wizardState.pdfBaseFileId,
        destinationFolderId: args.destinationFolderId,
      })

      // Optional: loggen (sparsam)
      if (wizardSessionIdRef.current) {
        void logWizardEventClient(wizardSessionIdRef.current, {
          eventType: 'file_saved',
          metadata: {
            promoted: true,
            movedBase: res.movedBase,
            movedArtifactFolder: res.movedArtifactFolder,
          },
        })
      }
    } catch (error) {
      if (wizardSessionIdRef.current) {
        void logWizardEventClient(wizardSessionIdRef.current, {
          eventType: 'error',
          error: {
            code: 'wizard_artifact_promotion_failed',
            message: error instanceof Error ? error.message : 'Unbekannter Fehler',
          },
        })
      }
    }
  }

  function scheduleMetadataEditedLog(metadata: Record<string, unknown>) {
    // Sparsam: debounced + nur wenn Keys sich geändert haben
    if (!wizardSessionIdRef.current) return
    if (metadataLogTimerRef.current) {
      window.clearTimeout(metadataLogTimerRef.current)
      metadataLogTimerRef.current = null
    }

    metadataLogTimerRef.current = window.setTimeout(() => {
      if (!wizardSessionIdRef.current) return
      const keys = Object.keys(metadata || {}).sort()
      const hash = keys.join("|")
      if (hash === lastLoggedMetadataKeysHashRef.current) return
      lastLoggedMetadataKeysHashRef.current = hash

      void logWizardEventClient(wizardSessionIdRef.current, {
        eventType: 'metadata_edited',
        stepIndex: wizardState.currentStepIndex,
        stepPreset: 'editDraft',
        metadata: {
          keysCount: keys.length,
          keysSample: keys.slice(0, 20),
        },
      })
    }, 1200)
  }

  // Wizard Session Logging: Session beim Mount erstellen
  // WICHTIG: Dieser Hook muss IMMER aufgerufen werden (keine frühen Returns), damit die Hook-Reihenfolge konsistent bleibt
  useEffect(() => {
    // Prüfe, ob bereits initialisiert (ohne frühen Return)
    const isAlreadyInitialized = !!wizardSessionIdRef.current
    
    if (!isAlreadyInitialized) {
      async function initializeWizardSession() {
        try {
          // User Identifier ermitteln (DSGVO-konform)
          const userIdentifier = getUserIdentifierClient()
          if (user?.id) {
            userIdentifier.userId = user.id
          }
          userIdentifierRef.current = userIdentifier
          
          // Session erstellen
          const sessionId = await createWizardSessionClient({
            userIdentifier,
            templateId,
            typeId,
            libraryId,
            initialStepIndex: wizardState.currentStepIndex,
          })
          
          wizardSessionIdRef.current = sessionId
        } catch (error) {
          console.error('[Wizard] Fehler beim Erstellen der Session:', error)
          // Nicht fatal: Wizard funktioniert auch ohne Logging
        }
      }
      
      void initializeWizardSession()
    }
  }, [templateId, typeId, libraryId, user?.id, wizardState.currentStepIndex]) // Dependencies hinzugefügt

  // Lade Template-Konfiguration
  useEffect(() => {
    async function loadTemplate() {
      try {
        setIsLoading(true)
        const loadedTemplate = await loadTemplateConfig(templateId, libraryId)
        
        if (!loadedTemplate) {
          toast.error("Template nicht gefunden")
          return
        }

        if (!loadedTemplate.creation || loadedTemplate.creation.flow.steps.length === 0) {
          toast.error("Template hat keinen gültigen Creation-Flow")
          return
        }

        setTemplate(loadedTemplate)
        
        // Wenn nur eine Quelle vorhanden ist, wähle sie automatisch aus
        const supportedSources = loadedTemplate.creation.supportedSources || []
        if (supportedSources.length === 1) {
          setWizardState(prev => {
            const steps = loadedTemplate.creation!.flow.steps
            const currentStep = steps[prev.currentStepIndex]
            
            const newState = {
              ...prev,
              selectedSource: supportedSources[0]!,
            }
            
            // Wenn der aktuelle Step chooseSource ist, springe zum nächsten Step
            if (currentStep?.preset === 'chooseSource') {
              const nextIndex = Math.min(prev.currentStepIndex + 1, steps.length - 1)
              return { ...newState, currentStepIndex: nextIndex }
            }
            
            // Wenn der nächste Step chooseSource ist, springe direkt darüber hinweg
            const nextStep = steps[prev.currentStepIndex + 1]
            if (nextStep?.preset === 'chooseSource') {
              const skipIndex = Math.min(prev.currentStepIndex + 2, steps.length - 1)
              return { ...newState, currentStepIndex: skipIndex }
            }
            
            return newState
          })
        }
      } catch (error) {
        toast.error(`Fehler beim Laden des Templates: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      } finally {
        setIsLoading(false)
      }
    }

    void loadTemplate()
  }, [templateId, libraryId])

  // Lade Datei für Resume-Modus
  useEffect(() => {
    async function loadResumeFile() {
      if (!resumeFileIdState || !provider || !template) {
        return
      }

      try {
        // Lade Datei-Inhalt
        const { blob } = await provider.getBinary(resumeFileIdState)
        const content = await blob.text()
        
        // Parse Frontmatter
        const { meta, body } = parseFrontmatter(content)
        
        // Rekonstruiere textSources als WizardSource[]
        const textSources: WizardSource[] = []
        const textSourcesArray = Array.isArray(meta.textSources) ? meta.textSources : []
        for (let i = 0; i < textSourcesArray.length; i++) {
          const text = textSourcesArray[i]
          if (typeof text === 'string' && text.trim().length > 0) {
            textSources.push({
              id: `text-${i}`,
              kind: 'text',
              text: text.trim(),
              createdAt: new Date(),
            })
          }
        }
        
        // Finde ersten editDraft Step (oder previewDetail als Fallback)
        const steps = template.creation?.flow.steps || []
        let targetStepIndex = 0
        for (let i = 0; i < steps.length; i++) {
          if (steps[i]?.preset === 'editDraft') {
            targetStepIndex = i
            break
          }
          if (steps[i]?.preset === 'previewDetail') {
            targetStepIndex = i
          }
        }
        
        // Initialisiere Wizard-State
        setWizardState({
          currentStepIndex: targetStepIndex,
          mode: 'form',
          sources: textSources,
          draftMetadata: meta,
          draftText: body,
        })
        
        toast.success("Datei geladen - Bearbeitung kann fortgesetzt werden")
      } catch (error) {
        toast.error(`Fehler beim Laden der Datei: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      }
    }

    void loadResumeFile()
  }, [resumeFileIdState, provider, template])

  // Lade Seed-Datei (z.B. Dialograum) und initialisiere Sources
  useEffect(() => {
    async function loadSeedFile() {
      if (!seedFileId || !provider || !template) {
        return
      }

      try {
        // Lade Dialograum-Datei
        const dialograumItem = await provider.getItemById(seedFileId)
        if (!dialograumItem) {
          toast.error("Seed-Datei nicht gefunden")
          return
        }

        const { blob } = await provider.getBinary(seedFileId)
        const content = await blob.text()
        const { body } = parseFrontmatter(content)
        
        // Erstelle WizardSource für Seed-Datei (Dialograum/Event/etc.)
        const seedSource: WizardSource = {
          id: `file-${seedFileId}`,
          kind: 'file',
          fileName: dialograumItem.metadata.name || 'unbekannt',
          extractedText: body.trim(),
          summary: body.length > 200 ? `${body.slice(0, 200)}...` : body,
          createdAt: new Date(),
        }
        
        // WICHTIG: Testimonials nur laden, wenn der Flow einen selectRelatedTestimonials Step hat
        // (z.B. beim Finalize-Wizard). Beim Testimonial-Creation-Wizard sollen KEINE Testimonials
        // als Quellen geladen werden, da dieser immer einen neuen Testimonial erstellen soll.
        const steps = template.creation?.flow.steps || []
        const hasSelectRelatedTestimonialsStep = steps.some(step => step.preset === 'selectRelatedTestimonials')
        
        // Seed-DocType bestimmen: Event nutzt filesystem discovery; Dialograum nutzt bestehende discovery
        const { meta: seedMeta } = parseFrontmatter(content)
        const seedDocType = typeof seedMeta.docType === 'string' ? seedMeta.docType.trim().toLowerCase() : ''

        const testimonialSources: WizardSource[] = hasSelectRelatedTestimonialsStep
          ? (seedDocType === 'event'
              ? await (async () => {
                  try {
                    return await findRelatedEventTestimonialsFilesystem({ provider, eventFileId: seedFileId, libraryId })
                  } catch (error) {
                    console.error('[Wizard] Fehler beim Laden von Testimonials:', error)
                    return []
                  }
                })()
              : await (async () => {
                  const testimonials = await findRelatedTestimonials({
                    provider,
                    startFileId: seedFileId,
                    libraryId,
                  })

                  const sources: WizardSource[] = []
                  for (const testimonial of testimonials) {
                    try {
                      const { blob: testimonialBlob } = await provider.getBinary(testimonial.fileId)
                      const testimonialContent = await testimonialBlob.text()
                      const { body: testimonialBody } = parseFrontmatter(testimonialContent)

                      sources.push({
                        id: `file-${testimonial.fileId}`,
                        kind: 'file',
                        fileName: testimonial.fileName,
                        extractedText: testimonialBody.trim(),
                        summary: `${testimonial.author_name || 'Teilnehmer'}: ${testimonial.teaser || testimonialBody.slice(0, 100)}...`,
                        createdAt: new Date(),
                      })
                    } catch (error) {
                      console.error(`Fehler beim Laden von Testimonial ${testimonial.fileId}:`, error)
                    }
                  }
                  return sources
                })())
          : [] // Keine Testimonials laden für Creation-Wizards
        
        // Kombiniere Sources: Seed zuerst, dann Testimonials (chronologisch sortiert)
        // Testimonials werden nach createdAt sortiert (chronologisch)
        const sortedTestimonialSources = [...testimonialSources].sort((a, b) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
          return aTime - bTime
        })
        const allSources = [seedSource, ...sortedTestimonialSources]
        
        // Finde ersten selectRelatedTestimonials Step (oder nächsten Step nach collectSource)
        let targetStepIndex = 0
        for (let i = 0; i < steps.length; i++) {
          if (steps[i]?.preset === 'selectRelatedTestimonials') {
            targetStepIndex = i
            break
          }
          if (steps[i]?.preset === 'generateDraft' && i > 0) {
            targetStepIndex = i
            break
          }
        }
        
        // Initialisiere Wizard-State
        setSeedFileIdState(seedFileId)
        setWizardState({
          currentStepIndex: targetStepIndex,
          mode: 'interview',
          sources: allSources,
        })
        
        // Toast-Nachricht: Nur Testimonials erwähnen, wenn welche geladen wurden
        if (hasSelectRelatedTestimonialsStep && testimonialSources.length > 0) {
          toast.success(`Seed geladen, ${testimonialSources.length} Testimonial(s) gefunden`)
        } else {
          toast.success('Seed geladen')
        }
      } catch (error) {
        toast.error(`Fehler beim Laden der Seed-Datei: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      }
    }

    void loadSeedFile()
  }, [seedFileId, provider, template, libraryId])

  // Cleanup: Markiere Session als abandoned wenn Component unmountet (ohne completed)
  // WICHTIG: Dieser Hook muss IMMER aufgerufen werden (vor frühen returns), damit die Hook-Reihenfolge konsistent bleibt
  useEffect(() => {
    const sessionIdRef = wizardSessionIdRef.current
    return () => {
      if (sessionIdRef && !wizardSessionCompletedRef.current) {
        // Wenn nicht explizit completed: als abandoned markieren (best effort).
        finalizeWizardSessionClient(sessionIdRef, 'abandoned', {
          finalStepIndex: latestStepIndexRef.current,
        }).catch(error => {
          console.warn('[Wizard] Fehler beim Markieren der Session als abandoned:', error)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Immer den aktuellsten StepIndex in eine Ref schreiben (damit cleanup beim Unmount korrekt ist)
  latestStepIndexRef.current = wizardState.currentStepIndex

  /**
   * Step-Telemetrie (Begin/End + Dauer) MUSS vor frühen returns stehen,
   * sonst ändert sich die Hook-Reihenfolge sobald das Template geladen ist.
   */
  const prevStepIndexRef = useRef<number | null>(null)
  const stepEnteredAtRef = useRef<number | null>(null)
  const lastEnteredKeyRef = useRef<string | null>(null)

  const stepsForTelemetry = template?.creation?.flow?.steps

  useEffect(() => {
    const sessionId = wizardSessionIdRef.current
    if (!sessionId) return
    if (!stepsForTelemetry || stepsForTelemetry.length === 0) return

    const step = stepsForTelemetry[wizardState.currentStepIndex]
    if (!step) return

    const stepKey = `${wizardState.currentStepIndex}:${String(step.preset || '')}`
    if (lastEnteredKeyRef.current === stepKey) return

    const prevIndex = prevStepIndexRef.current
    const prevEnteredAt = stepEnteredAtRef.current
    const now = nowMs()

    // 1) Exit vorherigen Step (falls vorhanden)
    if (typeof prevIndex === 'number' && prevIndex >= 0 && prevIndex < stepsForTelemetry.length && prevEnteredAt) {
      const prevStep = stepsForTelemetry[prevIndex]
      const durationMs = Math.max(0, now - prevEnteredAt)
      void logWizardEventClient(sessionId, {
        eventType: 'step_exited',
        stepIndex: prevIndex,
        stepPreset: prevStep?.preset,
        metadata: { durationMs },
      } satisfies Omit<WizardSessionEvent, 'eventId' | 'timestamp'>)
    }

    // 2) Enter aktueller Step
    stepEnteredAtRef.current = now
    prevStepIndexRef.current = wizardState.currentStepIndex
    lastEnteredKeyRef.current = stepKey

    void logWizardEventClient(sessionId, {
      eventType: 'step_entered',
      stepIndex: wizardState.currentStepIndex,
      stepPreset: step.preset,
    } satisfies Omit<WizardSessionEvent, 'eventId' | 'timestamp'>)
  }, [wizardState.currentStepIndex, stepsForTelemetry])

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </Card>
    )
  }

  if (!template || !template.creation) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          Template konnte nicht geladen werden oder hat keinen Creation-Flow.
        </div>
      </Card>
    )
  }

  // Nach dem Guard ist creation immer vorhanden; wir binden es an eine Konstante,
  // damit TypeScript die Narrowing-Information auch in Closures sauber beibehält.
  const creation = template.creation

  function toRenderableString(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    return JSON.stringify(value, null, 2)
  }

  /**
   * Rendert den Template-Body (`template.markdownBody`) mit {{var|...}} Tokens.
   * - Wenn ein Token-Wert fehlt, wird er leer gelassen.
   */
  function renderTemplateBody(args: { body: string; values: Record<string, unknown> }): string {
    const { body, values } = args
    let result = body || ""
    
    // Ersetze {{key|description}} Patterns
    result = result.replace(/\{\{([^}|]+)\|([\s\S]*?)\}\}/g, (_m, rawKey: string) => {
      const key = String(rawKey || "").trim()
      return toRenderableString(values[key])
    })
    
    // Ersetze auch {{key}} Patterns ohne Pipe (für einfache Variablen-Substitution)
    result = result.replace(/\{\{([^}]+)\}\}/g, (_m, rawKey: string) => {
      const key = String(rawKey || "").trim()
      // Überspringe, wenn bereits durch vorheriges Pattern ersetzt
      if (rawKey.includes('|')) return _m
      return toRenderableString(values[key])
    })
    
    return result
  }

  const steps = creation.flow.steps
  const currentStep = steps[wizardState.currentStepIndex]
  const isFirstStep = wizardState.currentStepIndex === 0
  const isLastStep = wizardState.currentStepIndex === steps.length - 1

  /**
   * Führt eine Re-Extraktion mit dem gesamten Quellen-Korpus durch.
   * Wird automatisch aufgerufen, wenn Quellen hinzugefügt oder entfernt werden.
   */
  const runExtraction = async (sources: WizardSource[]) => {
    if (sources.length === 0) {
      // Keine Quellen: Setze generatedDraft zurück
      setWizardState(prev => ({
        ...prev,
        generatedDraft: undefined,
        isExtracting: false,
      }))
      return
    }

    setWizardState(prev => ({ ...prev, isExtracting: true }))

    const extractionStartedAt = nowMs()
    const sessionIdForLogs = wizardSessionIdRef.current

    // Log job_started Event
    if (sessionIdForLogs) {
      const currentStepForLog = template?.creation?.flow?.steps?.[wizardState.currentStepIndex]
      void logWizardEventClient(sessionIdForLogs, {
        eventType: 'job_started',
        stepIndex: wizardState.currentStepIndex,
        stepPreset: currentStepForLog?.preset,
        metadata: {
          sourcesCount: sources.length,
          templateId,
        },
      })
    }

    try {
      // Baue Korpus-Text aus allen Quellen
      let corpusText = buildCorpusText(sources)
      
      // Prüfe Größe und kürze ggf.
      if (isCorpusTooLarge(corpusText)) {
        corpusText = truncateCorpus(corpusText)
        toast.warning("Korpus wurde gekürzt, um API-Limit einzuhalten")
      }

      if (!corpusText.trim()) {
        toast.error("Kein Text zum Verarbeiten vorhanden")
        setWizardState(prev => ({ ...prev, isExtracting: false }))
        if (sessionIdForLogs) {
          const currentStepForLog = template?.creation?.flow?.steps?.[wizardState.currentStepIndex]
          void logWizardEventClient(sessionIdForLogs, {
            eventType: 'job_failed',
            stepIndex: wizardState.currentStepIndex,
            stepPreset: currentStepForLog?.preset,
            metadata: { durationMs: Math.max(0, nowMs() - extractionStartedAt) },
            error: { code: 'empty_corpus', message: 'Kein Text zum Verarbeiten vorhanden' },
          })
        }
        return
      }

      // Rufe Secretary Service auf
      const formData = new FormData()
      formData.append("text", corpusText)
      formData.append("template", templateId)
      formData.append("target_language", "de")

      const response = await fetch("/api/secretary/process-text", {
        method: "POST",
        headers: {
          "X-Library-Id": libraryId,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error || `HTTP ${response.status}`
        if (sessionIdForLogs) {
          const currentStepForLog = template?.creation?.flow?.steps?.[wizardState.currentStepIndex]
          void logWizardEventClient(sessionIdForLogs, {
            eventType: 'job_failed',
            stepIndex: wizardState.currentStepIndex,
            stepPreset: currentStepForLog?.preset,
            metadata: { durationMs: Math.max(0, nowMs() - extractionStartedAt) },
            error: { code: 'api_error', message: errorMsg },
          })
        }
        throw new Error(errorMsg)
      }

      const result = await response.json()

      // Parse die Antwort (strukturierte Daten + Markdown)
      const metadata = result.structured_data || {}
      const markdown = result.markdown || ""

      // Aktualisiere generatedDraft
      setWizardState(prev => ({
        ...prev,
        generatedDraft: { metadata, markdown },
        isExtracting: false,
        extractionError: undefined,
      }))

      // Log extraction_completed Event
      if (sessionIdForLogs) {
        const durationMs = Math.max(0, nowMs() - extractionStartedAt)
        const currentStepForLog = template?.creation?.flow?.steps?.[wizardState.currentStepIndex]
        void logWizardEventClient(sessionIdForLogs, {
          eventType: 'job_completed',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStepForLog?.preset,
          metadata: {
            durationMs,
            sourcesCount: sources.length,
            corpusLength: corpusText.length,
            metadataKeys: Object.keys(metadata).length,
            markdownLength: markdown.length,
          },
        })
      }

      toast.success("Quellen wurden ausgewertet")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unbekannter Fehler"
      toast.error(`Fehler beim Auswerten: ${errorMsg}`)
      setWizardState(prev => ({ 
        ...prev, 
        isExtracting: false,
        extractionError: errorMsg
      }))
      
      // Log extraction_failed Event (falls noch nicht geloggt)
      if (sessionIdForLogs) {
        const durationMs = Math.max(0, nowMs() - extractionStartedAt)
        const currentStepForLog = template?.creation?.flow?.steps?.[wizardState.currentStepIndex]
        void logWizardEventClient(sessionIdForLogs, {
          eventType: 'job_failed',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStepForLog?.preset,
          metadata: { durationMs },
          error: { code: 'extraction_error', message: errorMsg },
        })
      }
    }
  }

  interface JobUpdateWire {
    type: 'job_update'
    jobId: string
    status: string
    progress?: number
    message?: string
    result?: { savedItemId?: string }
    shadowTwinFolderId?: string | null
  }

  async function waitForJobCompletionWithProgress(args: {
    jobId: string
    timeoutMs: number
    onProgress: (evt: JobUpdateWire) => void
  }): Promise<JobUpdateWire> {
    const { jobId, timeoutMs, onProgress } = args
    return await new Promise<JobUpdateWire>((resolve, reject) => {
      let settled = false
      const es = new EventSource('/api/external/jobs/stream')
      let pollTimer: number | null = null
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        try { es.close() } catch {}
        if (pollTimer !== null) {
          try { window.clearInterval(pollTimer) } catch {}
        }
        reject(new Error(`Timeout: Job ${jobId} wurde nicht rechtzeitig fertig.`))
      }, timeoutMs)

      function cleanup() {
        clearTimeout(timeout)
        try { es.close() } catch {}
        if (pollTimer !== null) {
          try { window.clearInterval(pollTimer) } catch {}
        }
      }

      // Fallback: Wenn SSE (dev) wackelt oder Completion-Event verloren geht,
      // pollen wir den Job-Status und lösen trotzdem auf.
      pollTimer = window.setInterval(() => {
        if (settled) return
        void (async () => {
          try {
            const res = await fetch(`/api/external/jobs/${jobId}`, { method: 'GET' })
            const json = await res.json().catch(() => ({} as Record<string, unknown>))
            if (!res.ok) return
            const status = typeof (json as { status?: unknown }).status === 'string' ? (json as { status: string }).status : ''
            if (status !== 'completed' && status !== 'failed') return

            const resultUnknown = (json as { result?: unknown }).result
            const result = (resultUnknown && typeof resultUnknown === 'object' && !Array.isArray(resultUnknown))
              ? (resultUnknown as { savedItemId?: unknown })
              : undefined
            const savedItemId = typeof result?.savedItemId === 'string' ? result.savedItemId : undefined

            const shadowTwinStateUnknown = (json as { shadowTwinState?: unknown }).shadowTwinState
            const shadowTwinFolderId = (shadowTwinStateUnknown && typeof shadowTwinStateUnknown === 'object' && 'shadowTwinFolderId' in (shadowTwinStateUnknown as Record<string, unknown>))
              ? ((shadowTwinStateUnknown as Record<string, unknown>).shadowTwinFolderId)
              : undefined
            const shadowTwinFolderIdStr = typeof shadowTwinFolderId === 'string' ? shadowTwinFolderId : null

            const synthetic: JobUpdateWire = {
              type: 'job_update',
              jobId,
              status,
              progress: status === 'completed' ? 100 : undefined,
              message: status === 'completed' ? 'completed (poll)' : 'failed (poll)',
              result: savedItemId ? { savedItemId } : undefined,
              shadowTwinFolderId: shadowTwinFolderIdStr,
            }
            onProgress(synthetic)

            if (status === 'completed') {
              if (settled) return
              settled = true
              cleanup()
              resolve(synthetic)
            }
            if (status === 'failed') {
              if (settled) return
              settled = true
              cleanup()
              reject(new Error('Job fehlgeschlagen'))
            }
          } catch {
            // ignore polling errors
          }
        })()
      }, 1200)

      es.addEventListener('job_update', (e: MessageEvent) => {
        try {
          const evt = JSON.parse(e.data) as JobUpdateWire
          if (!evt || evt.type !== 'job_update' || evt.jobId !== jobId) return
          onProgress(evt)
          if (evt.status === 'completed') {
            if (settled) return
            settled = true
            cleanup()
            resolve(evt)
            return
          }
          if (evt.status === 'failed') {
            if (settled) return
            settled = true
            cleanup()
            reject(new Error(evt.message || 'Job fehlgeschlagen'))
          }
        } catch {
          // ignore parse errors
        }
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function resolvePdfAnalyseTransformFileId(args: {
    baseFileId: string
    targetLanguage: string
  }): Promise<string | undefined> {
    // Frontend darf nicht selbst Shadow-Twin Dateien suchen (list+match).
    // Wir lösen das serverseitig über den zentralen Resolver auf.
    if (!provider || !libraryId) return undefined
    try {
      const baseItem = await provider.getItemById(args.baseFileId)
      const sourceName = String(baseItem?.metadata?.name || '')
      const parentId = String(baseItem?.parentId || '')
      if (!sourceName || !parentId) return undefined

      const resolved = await resolveArtifactClient({
        libraryId,
        sourceId: args.baseFileId,
        sourceName,
        parentId,
        targetLanguage: args.targetLanguage,
        templateName: 'pdfanalyse',
        preferredKind: 'transformation',
      })
      return resolved?.fileId
    } catch {
      return undefined
    }
  }

  /**
   * Fügt eine neue Quelle hinzu und triggert automatische Transformation.
   * Wenn bereits eine Text-Quelle existiert, wird diese aktualisiert statt eine neue zu erstellen.
   * Verhindert auch, dass Quellen mit derselben ID doppelt hinzugefügt werden.
   */
  const addSource = async (source: WizardSource) => {
    // Single-Source UX: Wenn das Template nur "file" unterstützt, soll die Quelle-Auswahl nicht wieder erscheinen.
    // Sonst sieht man während PDF-HITL Processing die "Startmethode"/"Quellen"-Infos (verwirrend).
    const supportedSources = template?.creation?.supportedSources || []
    const isSingleFileOnly = supportedSources.length === 1 && supportedSources[0]?.type === 'file'

    // WICHTIG: Verwende setWizardState mit Updater-Funktion, um Race Conditions zu vermeiden
    // (wenn addSource mehrfach schnell hintereinander aufgerufen wird)
    let wasUpdated = false
    let finalSources: WizardSource[] = []
    
    setWizardState(prev => {
      // Prüfe, ob eine Quelle mit derselben ID bereits existiert (verhindert Duplikate)
      const existingSourceIndex = prev.sources.findIndex(s => s.id === source.id)
      if (existingSourceIndex >= 0) {
        // Quelle existiert bereits: Aktualisiere sie statt eine neue hinzuzufügen
        const updatedSources = [...prev.sources]
        updatedSources[existingSourceIndex] = {
          ...source,
          id: updatedSources[existingSourceIndex].id, // Behalte die bestehende ID
          createdAt: updatedSources[existingSourceIndex].createdAt, // Behalte das ursprüngliche Datum
        }
        wasUpdated = true
        finalSources = updatedSources
        return {
          ...prev,
          sources: updatedSources,
          selectedSource: isSingleFileOnly ? prev.selectedSource : undefined, // Multi-Source: Reset; Single-File: behalten
        }
      }

      // Zusätzliche Prüfung für File-Quellen: Verhindere Duplikate auch wenn ID unterschiedlich ist (z.B. durch verschiedene Generierungszeitpunkte)
      if (source.kind === 'file' && source.fileName) {
        const existingFileSourceIndex = prev.sources.findIndex(
          s => s.kind === 'file' && s.fileName === source.fileName
        )
        if (existingFileSourceIndex >= 0) {
          // File-Quelle mit gleichem Dateinamen existiert bereits: Aktualisiere sie statt eine neue hinzuzufügen
          const updatedSources = [...prev.sources]
          updatedSources[existingFileSourceIndex] = {
            ...source,
            id: updatedSources[existingFileSourceIndex].id, // Behalte die bestehende ID
            createdAt: updatedSources[existingFileSourceIndex].createdAt, // Behalte das ursprüngliche Datum
          }
          wasUpdated = true
          finalSources = updatedSources
          return {
            ...prev,
            sources: updatedSources,
            selectedSource: isSingleFileOnly ? prev.selectedSource : undefined, // Multi-Source: Reset; Single-File: behalten
          }
        }
      }

      // Wenn es eine Text-Quelle ist und bereits eine Text-Quelle existiert, aktualisiere diese
      if (source.kind === 'text') {
        const existingTextSourceIndex = prev.sources.findIndex(s => s.kind === 'text')
        if (existingTextSourceIndex >= 0) {
          // Aktualisiere die bestehende Text-Quelle
          const updatedSources = [...prev.sources]
          updatedSources[existingTextSourceIndex] = {
            ...source,
            id: updatedSources[existingTextSourceIndex].id, // Behalte die bestehende ID
            createdAt: updatedSources[existingTextSourceIndex].createdAt, // Behalte das ursprüngliche Datum
          }
          wasUpdated = true
          finalSources = updatedSources
          return {
            ...prev,
            sources: updatedSources,
            selectedSource: isSingleFileOnly ? prev.selectedSource : undefined, // Multi-Source: Reset; Single-File: behalten
          }
        }
      }

      // Quelle existiert noch nicht: Hinzufügen
      const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
      finalSources = [...prev.sources, source]
      return {
        ...prev,
        sources: finalSources,
        selectedSource: isSingleFileOnly ? prev.selectedSource : undefined, // Multi-Source: Reset; Single-File: behalten
        // Für pdfanalyse: Metadaten erst nach "Weiter" laden, nicht sofort im Hintergrund.
        generatedDraft: isPdfAnalyse ? undefined : prev.generatedDraft,
      }
    })

    // Log source_added Event
    if (wizardSessionIdRef.current && !wasUpdated) {
      await logWizardEventClient(wizardSessionIdRef.current, {
        eventType: 'source_added',
        sourceId: source.id,
        sourceKind: source.kind,
        metadata: {
          fileName: source.fileName,
          textLength: source.text?.length,
          extractedTextLength: source.extractedText?.length,
        },
      })
    }

    // Verarbeitung nur starten, wenn nicht pdfanalyse
    const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
    if (!isPdfAnalyse) {
      await runExtraction(finalSources)
    }
  }

  /**
   * Entfernt eine Quelle und triggert automatische Transformation.
   */
  const removeSource = async (sourceId: string) => {
    const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
    const newSources = wizardState.sources.filter(s => s.id !== sourceId)
    setWizardState(prev => ({ 
      ...prev, 
      sources: newSources,
      generatedDraft: isPdfAnalyse ? undefined : prev.generatedDraft,
    }))

    // Log source_removed Event (best effort)
    if (wizardSessionIdRef.current) {
      logWizardEventClient(wizardSessionIdRef.current, {
        eventType: 'source_removed',
        sourceId,
      }).catch(error => console.warn('[Wizard] Fehler beim Loggen von source_removed:', error))
    }
    if (!isPdfAnalyse) {
      await runExtraction(newSources)
    }
  }

  const handleNext = async () => {
    if (isLastStep) {
      // Publish-Step: "Fertig" navigiert nur noch zurück. Der Step selbst finalisiert Session/Publish.
      if (currentStep.preset === 'publish') {
        router.push("/library")
        return
      }
      handleSave()
      return
    }

    // Beim Verlassen von collectSource: Füge noch nicht hinzugefügte Quelle hinzu
    if (currentStep.preset === 'collectSource') {
      let justAddedSource: WizardSource | null = null
      const createSource = window.__collectSourceStepBeforeLeave
      if (createSource && typeof createSource === 'function') {
        const newSource = createSource()
        if (newSource) {
          justAddedSource = newSource
          await addSource(newSource)
        }
      }

      // PDF HITL: Nach "Weiter" starten wir erst die Verarbeitung (Extract-only) und bleiben dabei auf diesem Screen.
      const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
      if (isPdfAnalyse) {
        if (!provider) {
          toast.error('Storage ist noch nicht bereit', { description: 'Bitte kurz warten und dann erneut auf „Weiter“ klicken.' })
          if (wizardSessionIdRef.current) {
            void logWizardEventClient(wizardSessionIdRef.current, {
              eventType: 'error',
              error: { code: 'pdf_collect_missing_provider', message: 'provider fehlt beim Klick auf Weiter' },
            })
          }
          return
        }
        if (!libraryId) {
          toast.error('Kontext fehlt', { description: 'libraryId fehlt – bitte Seite neu laden.' })
          if (wizardSessionIdRef.current) {
            void logWizardEventClient(wizardSessionIdRef.current, {
              eventType: 'error',
              error: { code: 'pdf_collect_missing_libraryId', message: 'libraryId fehlt beim Klick auf Weiter' },
            })
          }
          return
        }
        // Wichtig: State-Updates via addSource() sind in diesem Tick noch nicht garantiert sichtbar.
        // Darum nutzen wir primär die Quelle, die wir gerade hinzugefügt haben.
        const baseFileIdFromJustAdded =
          justAddedSource?.kind === 'file' && typeof justAddedSource.id === 'string' && justAddedSource.id.startsWith('file-')
            ? justAddedSource.id.replace(/^file-/, '')
            : ''
        const fileSource = baseFileIdFromJustAdded
          ? null
          : [...wizardState.sources].reverse().find(s => s.kind === 'file' && typeof s.id === 'string' && s.id.startsWith('file-'))
        const baseFileId = baseFileIdFromJustAdded || (fileSource ? fileSource.id.replace(/^file-/, '') : '')
        if (!baseFileId) {
          toast.error('Bitte zuerst eine PDF auswählen', { description: 'Es wurde keine Datei gefunden, die verarbeitet werden kann.' })
          if (wizardSessionIdRef.current) {
            void logWizardEventClient(wizardSessionIdRef.current, {
              eventType: 'error',
              error: { code: 'pdf_collect_missing_baseFileId', message: 'baseFileId konnte nicht bestimmt werden' },
            })
          }
          return
        }
        if (baseFileId) {
          // Step 1: Extract-only Job starten
          setWizardState(prev => ({
            ...prev,
            isExtracting: true,
            processingProgress: 0,
            processingMessage: 'OCR/Artefakte starten…',
            pdfBaseFileId: baseFileId,
          }))
          let extractJobId = ''
          try {
            const baseItem = await provider.getItemById(baseFileId)
            const wizardFolderId = baseItem.parentId || 'root'
            const fileName = baseItem.metadata?.name || 'document.pdf'
            const mimeType = baseItem.metadata?.mimeType || 'application/pdf'

            const form = new FormData()
            form.append('originalItemId', baseFileId)
            form.append('parentId', wizardFolderId)
            form.append('fileName', fileName)
            form.append('mimeType', mimeType)
            form.append('targetLanguage', 'de')
            form.append('extractionMethod', 'mistral_ocr')
            form.append('includeOcrImages', 'true')
            form.append('includePageImages', 'true')
            form.append('useCache', 'false')
            // Extract-only: keine Metadaten, kein Ingest
            form.append('policies', JSON.stringify({ extract: 'do', metadata: 'ignore', ingest: 'ignore' }))

            const res = await fetch('/api/secretary/process-pdf', { method: 'POST', headers: { 'X-Library-Id': libraryId }, body: form })
            const json = await res.json().catch(() => ({} as Record<string, unknown>))
            if (!res.ok) {
              const msg = typeof (json as { error?: unknown }).error === 'string' ? (json as { error: string }).error : `HTTP ${res.status}`
              throw new Error(msg)
            }
            extractJobId = typeof (json as { job?: { id?: unknown } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : ''
            if (!extractJobId) throw new Error('Job-ID fehlt in Response')

            // Log job_started Event
            if (wizardSessionIdRef.current) {
              await addJobIdToSessionClient(wizardSessionIdRef.current, extractJobId, 'pdf_extract')
            }

            const completion = await waitForJobCompletionWithProgress({
              jobId: extractJobId,
              timeoutMs: 8 * 60_000,
              onProgress: (evt) => {
                setWizardState(prev => ({
                  ...prev,
                  processingProgress: typeof evt.progress === 'number' ? evt.progress : prev.processingProgress,
                  processingMessage: evt.message || prev.processingMessage,
                }))
              }
            })

            const transcriptFileId = completion.result?.savedItemId
            if (!transcriptFileId) throw new Error('Extract abgeschlossen, aber result.savedItemId fehlt (Transcript).')
            const transcriptItemForFolder = await provider.getItemById(transcriptFileId)
            const transcriptFolderId = transcriptItemForFolder.parentId || 'root'
            const { blob } = await provider.getBinary(transcriptFileId)
            const transcript = await blob.text()

            // Log job_completed Event
            if (wizardSessionIdRef.current) {
              await logWizardEventClient(wizardSessionIdRef.current, {
                eventType: 'job_completed',
                jobId: extractJobId,
                jobType: 'pdf_extract',
                fileIds: {
                  transcriptFileId,
                  baseFileId: baseFileId,
                },
              })
            }

            // Nächster Step: Markdown Review
            setWizardState(prev => ({
              ...prev,
              isExtracting: false,
              processingProgress: undefined,
              processingMessage: undefined,
              pdfTranscriptFileId: transcriptFileId,
              pdfTranscriptFolderId: transcriptFolderId,
              draftText: transcript,
              hasConfirmedMarkdown: false,
              // Wir bleiben im Interview-Modus, aber springen zum nächsten Step
              currentStepIndex: Math.min(prev.currentStepIndex + 1, steps.length - 1),
            }))
            
            // Log step_changed Event
            if (wizardSessionIdRef.current) {
              const newIndex = Math.min(wizardState.currentStepIndex + 1, steps.length - 1)
              const newStep = steps[newIndex]
              await logWizardEventClient(wizardSessionIdRef.current, {
                eventType: 'step_changed',
                stepIndex: newIndex,
                stepPreset: newStep?.preset,
              })
            }
            
            return
          } catch (error) {
            setWizardState(prev => ({
              ...prev,
              isExtracting: false,
              processingProgress: undefined,
              processingMessage: undefined,
              extractionError: error instanceof Error ? error.message : 'Unbekannter Fehler',
            }))
            
            // Log job_failed Event (wenn Job-ID bekannt)
            if (wizardSessionIdRef.current && extractJobId) {
              try {
                await logWizardEventClient(wizardSessionIdRef.current, {
                  eventType: 'job_failed',
                  jobId: extractJobId,
                  jobType: 'pdf_extract',
                  error: {
                    code: 'pdf_extract_failed',
                    message: error instanceof Error ? error.message : 'Unbekannter Fehler',
                  },
                })
              } catch (logError) {
                console.warn('[Wizard] Fehler beim Loggen von job_failed:', logError)
              }
            }

            // Log error Event
            if (wizardSessionIdRef.current) {
              await logWizardEventClient(wizardSessionIdRef.current, {
                eventType: 'error',
                error: {
                  code: 'pdf_extract_failed',
                  message: error instanceof Error ? error.message : 'Unbekannter Fehler',
                },
              })
            }
            
            toast.error('PDF-Verarbeitung fehlgeschlagen', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' })
            return
          }
        }
        // WICHTIG: pdfanalyse darf nie in die generische Step-Advance-Logik fallen.
        return
      }
    }

    // PDF HITL: Nach Markdown-Review startet die Metadaten/Template-Phase (und optional Ingest)
    if (currentStep.preset === 'reviewMarkdown') {
      const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
      if (isPdfAnalyse) {
        if (!provider || !wizardState.pdfBaseFileId || !wizardState.pdfTranscriptFileId) {
          toast.error('PDF-Status unvollständig', { description: 'Bitte gehe zurück und starte zuerst die PDF-Verarbeitung (OCR).' })
          if (wizardSessionIdRef.current) {
            void logWizardEventClient(wizardSessionIdRef.current, {
              eventType: 'error',
              error: { code: 'pdf_review_missing_state', message: 'pdfBaseFileId/pdfTranscriptFileId/provider fehlt beim Klick auf Weiter' },
            })
          }
          return
        }
        if (!wizardState.hasConfirmedMarkdown) {
          toast.error('Bitte Markdown bestätigen', { description: 'Aktiviere die Checkbox, dass du das Markdown geprüft hast.' })
          return
        }
        const updatedMarkdown = (wizardState.draftText || '').trim()
        if (!updatedMarkdown) {
          toast.error('Markdown ist leer', { description: 'Bitte korrigiere das Markdown oder gehe zurück.' })
          return
        }

        setWizardState(prev => ({
          ...prev,
          isExtracting: true,
          processingProgress: 0,
          processingMessage: 'Metadaten/Template starten…',
        }))

        let templateJobId = ''
        try {
          // 1) Korrigiertes Transcript zurück ins Shadow‑Twin schreiben (delete+upload, da kein overwrite-by-id)
          const transcriptItem = await provider.getItemById(wizardState.pdfTranscriptFileId)
          const transcriptParentId = transcriptItem.parentId || 'root'
          const transcriptName = transcriptItem.metadata?.name || 'transcript.de.md'
          await provider.deleteItem(wizardState.pdfTranscriptFileId)
          const uploaded = await provider.uploadFile(
            transcriptParentId,
            new File([updatedMarkdown], transcriptName, { type: 'text/markdown' })
          )

          // 2) Job 2: Template + Ingest (extract ignore, gate nutzt vorhandenes Transcript im Shadow‑Twin)
          const baseItem = await provider.getItemById(wizardState.pdfBaseFileId)
          const wizardFolderId = baseItem.parentId || 'root'
          const fileName = baseItem.metadata?.name || 'document.pdf'
          const mimeType = baseItem.metadata?.mimeType || 'application/pdf'

          const form = new FormData()
          form.append('originalItemId', wizardState.pdfBaseFileId)
          form.append('parentId', wizardFolderId)
          form.append('fileName', fileName)
          form.append('mimeType', mimeType)
          form.append('targetLanguage', 'de')
          form.append('extractionMethod', 'mistral_ocr')
          form.append('includeOcrImages', 'true')
          form.append('includePageImages', 'true')
          form.append('useCache', 'false')
          form.append('template', 'pdfanalyse')
          // PDF Human-in-the-loop: Job2 erzeugt/aktualisiert das Transformations-Artefakt,
          // aber "Publizieren/Ingest" passiert erst beim expliziten Speichern im Wizard.
          form.append('policies', JSON.stringify({ extract: 'ignore', metadata: 'do', ingest: 'ignore' }))

          const res = await fetch('/api/secretary/process-pdf', { method: 'POST', headers: { 'X-Library-Id': libraryId }, body: form })
          const json = await res.json().catch(() => ({} as Record<string, unknown>))
          if (!res.ok) {
            const msg = typeof (json as { error?: unknown }).error === 'string' ? (json as { error: string }).error : `HTTP ${res.status}`
            throw new Error(msg)
          }
          templateJobId = typeof (json as { job?: { id?: unknown } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : ''
          if (!templateJobId) throw new Error('Job-ID fehlt in Response')

          // Log job_started Event (Template Phase)
          if (wizardSessionIdRef.current) {
            await addJobIdToSessionClient(wizardSessionIdRef.current, templateJobId, 'pdf_template')
          }

          const completion = await waitForJobCompletionWithProgress({
            jobId: templateJobId,
            timeoutMs: 8 * 60_000,
            onProgress: (evt) => {
              setWizardState(prev => ({
                ...prev,
                processingProgress: typeof evt.progress === 'number' ? evt.progress : prev.processingProgress,
                processingMessage: evt.message || prev.processingMessage,
              }))
            }
          })

          const transformFileId = completion.result?.savedItemId
          if (!transformFileId) {
            // Absichtlich hart: wenn das fehlt oder falsch ist, muss der zentrale Job-Contract gefixt werden,
            // statt im Wizard "auszugleichen" (sonst debuggen wir am Symptom vorbei).
            throw new Error('Template abgeschlossen, aber result.savedItemId (Transformation) fehlt.')
          }

          const { blob } = await provider.getBinary(transformFileId)
          const content = await blob.text()
          const { meta, body } = parseFrontmatter(content)

          // Log job_completed Event (Template Phase)
          if (wizardSessionIdRef.current) {
            await logWizardEventClient(wizardSessionIdRef.current, {
              eventType: 'job_completed',
              jobId: templateJobId,
              jobType: 'pdf_template',
              fileIds: {
                transformFileId,
                baseFileId: wizardState.pdfBaseFileId,
                transcriptFileId: uploaded.id,
              },
            })
          }

          // 3) In EditDraft springen (Metadaten prüfen)
          setWizardState(prev => ({
            ...prev,
            isExtracting: false,
            processingProgress: undefined,
            processingMessage: undefined,
            pdfTranscriptFileId: uploaded.id,
            pdfTranscriptFolderId: transcriptParentId,
            pdfTransformFileId: transformFileId,
            generatedDraft: { metadata: (meta && typeof meta === 'object') ? (meta as Record<string, unknown>) : {}, markdown: typeof body === 'string' ? body : '' },
            draftMetadata: (meta && typeof meta === 'object') ? (meta as Record<string, unknown>) : prev.draftMetadata,
            draftText: typeof body === 'string' ? body : prev.draftText,
            currentStepIndex: Math.min(prev.currentStepIndex + 1, steps.length - 1),
          }))
          
          // Log step_changed Event
          if (wizardSessionIdRef.current) {
            const newIndex = Math.min(wizardState.currentStepIndex + 1, steps.length - 1)
            const newStep = steps[newIndex]
            logWizardEventClient(wizardSessionIdRef.current, {
              eventType: 'step_changed',
              stepIndex: newIndex,
              stepPreset: newStep?.preset,
            }).catch(error => console.warn('[Wizard] Fehler beim Loggen von step_changed:', error))
          }
          
          return
        } catch (error) {
          setWizardState(prev => ({
            ...prev,
            isExtracting: false,
            processingProgress: undefined,
            processingMessage: undefined,
            extractionError: error instanceof Error ? error.message : 'Unbekannter Fehler',
          }))
          
          // Log job_failed Event (wenn Job-ID bekannt)
          if (wizardSessionIdRef.current && templateJobId) {
            try {
              await logWizardEventClient(wizardSessionIdRef.current, {
                eventType: 'job_failed',
                jobId: templateJobId,
                jobType: 'pdf_template',
                error: {
                  code: 'pdf_template_failed',
                  message: error instanceof Error ? error.message : 'Unbekannter Fehler',
                },
              })
            } catch (logError) {
              console.warn('[Wizard] Fehler beim Loggen von job_failed:', logError)
            }
          }

          // Log error Event
          if (wizardSessionIdRef.current) {
            try {
              await logWizardEvent(wizardSessionIdRef.current, {
                eventType: 'error',
                error: {
                  code: 'pdf_template_failed',
                  message: error instanceof Error ? error.message : 'Unbekannter Fehler',
                },
              })
            } catch (logError) {
              console.warn('[Wizard] Fehler beim Loggen von error:', logError)
            }
          }
          
          toast.error('Metadaten/Template fehlgeschlagen', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' })
          return
        }
        // WICHTIG: pdfanalyse darf nie in die generische Step-Advance-Logik fallen.
        return
      }
    }

    setWizardState(prev => {
      const nextRawIndex = prev.currentStepIndex + 1
      const nextStep = steps[nextRawIndex]

      // UX: Wenn Briefing vorhanden ist, sollen unnötige Zwischensteps verschwinden.
      // - Form-Modus: springe direkt zum nächsten editDraft (wenn vorhanden)
      // - Interview-Modus: wenn Source bereits gewählt, überspringe chooseSource
      if (prev.mode === 'form') {
        const editDraftIndex = steps.findIndex((s, idx) => idx > prev.currentStepIndex && s.preset === 'editDraft')
        if (editDraftIndex >= 0) {
          return { ...prev, currentStepIndex: editDraftIndex }
        }
      }

      if (nextStep?.preset === 'chooseSource' && prev.selectedSource) {
        return { ...prev, currentStepIndex: Math.min(nextRawIndex + 1, steps.length - 1) }
      }

      // UX: Wenn wir bereits structured_data haben (durch Multi-Source Re-Extract), ist generateDraft redundant.
      // WICHTIG: Nur überspringen, wenn der Draft wirklich existiert.
      // `sources.length > 0` ist KEIN Indikator für einen generierten Draft (z.B. Finalize-Flow lädt Sources automatisch).
      if (nextStep?.preset === 'generateDraft' && !!prev.generatedDraft) {
        return { ...prev, currentStepIndex: Math.min(nextRawIndex + 1, steps.length - 1) }
      }

      return { ...prev, currentStepIndex: nextRawIndex }
    })
    
    // Log step_changed Event
    if (wizardSessionIdRef.current) {
      const nextRawIndex = wizardState.currentStepIndex + 1
      const nextStep = steps[nextRawIndex]
      logWizardEvent(wizardSessionIdRef.current, {
        eventType: 'step_changed',
        stepIndex: nextRawIndex,
        stepPreset: nextStep?.preset,
      }).catch(error => console.warn('[Wizard] Fehler beim Loggen von step_changed:', error))
    }
  }

  const handleBack = () => {
    if (isFirstStep) return
    
    setWizardState(prev => {
      const newIndex = prev.currentStepIndex - 1
      const newStep = steps[newIndex]
      const supportedSources = template?.creation?.supportedSources || []
      const isSingleFileOnly = supportedSources.length === 1 && supportedSources[0]?.type === 'file'
      
      // Wenn wir zurück zum collectSource Step gehen,
      // setze selectedSource IMMER zurück, damit die Quelle-Auswahl wieder angezeigt wird
      if (newStep?.preset === 'collectSource') {
        return {
          ...prev,
          currentStepIndex: newIndex,
          selectedSource: isSingleFileOnly ? prev.selectedSource : undefined, // Single-File: nicht zurück in Auswahl springen
        }
      }
      
      return {
        ...prev,
        currentStepIndex: newIndex,
      }
    })
    
    // Log step_changed Event (fire and forget)
    if (wizardSessionIdRef.current) {
      const newIndex = wizardState.currentStepIndex - 1
      const newStep = steps[newIndex]
      logWizardEventClient(wizardSessionIdRef.current, {
        eventType: 'step_changed',
        stepIndex: newIndex,
        stepPreset: newStep?.preset,
      }).catch(error => console.warn('[Wizard] Fehler beim Loggen von step_changed:', error))
    }
  }

  const handleSave = async (opts?: {
    navigateToLibrary?: boolean
    ingestEvent?: boolean
    /**
     * Session-Finalisierung (wizard_completed + finalize) nach Speichern.
     * Im Publish-Step wollen wir das bewusst erst NACH Ingestion/Publish machen,
     * damit die Timeline im wizard_sessions Log korrekt ist.
     */
    finalizeSession?: boolean
  }): Promise<{ savedItemId?: string; fileName?: string; targetFolderId?: string; slug?: string } | undefined> => {
    if (!provider) {
      toast.error("Kein Storage Provider verfügbar")
      return
    }
    if (!template?.creation) {
      toast.error("Template ist nicht geladen")
      return
    }

    const sessionIdForLogs = wizardSessionIdRef.current
    const saveStartedAt = nowMs()
    if (sessionIdForLogs) {
      void logWizardEventClient(sessionIdForLogs, {
        eventType: 'save_started',
        stepIndex: wizardState.currentStepIndex,
        stepPreset: currentStep?.preset,
      })
    }

    try {
      // Bestimme Metadaten und Markdown-Text
      // Priorität: draftMetadata/draftText (Form-Modus) > reviewedFields/generatedDraft (Interview-Modus)
      const baseMetadata = wizardState.draftMetadata 
        || wizardState.reviewedFields 
        || wizardState.generatedDraft?.metadata 
        || {}
      
      const preferredMarkdown = wizardState.draftText 
        || wizardState.generatedDraft?.markdown 
        || ""

      if (Object.keys(baseMetadata).length === 0 && !preferredMarkdown.trim()) {
        toast.error("Keine Daten zum Speichern vorhanden")
        return
      }

      // Wenn createInOwnFolder=true, muss der Dateiname eindeutig sein, damit nicht mehrere
      // Testimonials am selben Tag denselben Ordner verwenden und sich überschreiben
      const createInOwnFolder = template.creation.output?.createInOwnFolder === true
      const { fileName, updatedMetadata: finalMetadata } = buildCreationFileName({
        typeId,
        metadata: baseMetadata,
        config: {
          ...template.creation.output?.fileName,
          ensureUnique: createInOwnFolder, // Eindeutigkeit sicherstellen bei createInOwnFolder
        },
      })

      // Bestimme OwnerId (Dateiname ohne Extension)
      // Wird u.a. für Bild-Uploads verwendet (Pfad/Scope).
      const ownerId = fileName.replace(/\.[^.]+$/, '')

      // Bestimme Scope aus zentralem Template-DetailViewType
      const detailViewType = resolveTemplateDetailViewType()
      const scope: 'books' | 'sessions' = detailViewType === 'book' ? 'books' : 'sessions'

      // Verwende bereits hochgeladene Bild-URLs oder lade sie jetzt hoch
      // Bildfelder kommen aus dem uploadImages Step (fields)
      const uploadImagesStepForSave = template.creation.flow.steps.find(step => step.preset === 'uploadImages')
      const imageFieldKeysForSave = uploadImagesStepForSave?.fields || []
      const imageFiles = wizardState.imageFiles || {}
      const alreadyUploadedUrls = wizardState.imageUrls || {}
      const imageUrls: Record<string, string> = {}

      for (const fieldKey of imageFieldKeysForSave) {
        // Wenn bereits hochgeladen, verwende diese URL
        if (alreadyUploadedUrls[fieldKey]) {
          imageUrls[fieldKey] = alreadyUploadedUrls[fieldKey]
          // Optional: Nochmal mit echter OwnerId hochladen für Konsistenz
          // (aktuell verwenden wir die bereits hochgeladene URL)
          continue
        }

        // Fallback: Lade jetzt hoch (falls nicht bereits geschehen)
        const file = imageFiles[fieldKey]
        if (file) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('key', fieldKey)
            formData.append('ownerId', ownerId)
            formData.append('scope', scope)

            const response = await fetch('/api/creation/upload-image', {
              method: 'POST',
              headers: {
                'X-Library-Id': libraryId,
              },
              body: formData,
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const result = await response.json()
            if (result.url && typeof result.url === 'string') {
              imageUrls[fieldKey] = result.url
            }
          } catch (error) {
            toast.error(`Fehler beim Hochladen von ${fieldKey}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
            // Weiter mit anderen Bildern, auch wenn eines fehlschlägt
            if (wizardSessionIdRef.current) {
              void logWizardEventClient(wizardSessionIdRef.current, {
                eventType: 'error',
                error: {
                  code: 'upload_image_failed',
                  message: error instanceof Error ? error.message : 'Unbekannter Fehler',
                  details: { fieldKey },
                },
              })
            }
          }
        }
      }

      // Merge Bild-URLs in finalMetadata
      const metadataWithImages = {
        ...finalMetadata,
        ...imageUrls,
      }

      /**
       * Frontmatter darf nur Template-Metadaten enthalten.
       * Alle "Body-only" Felder (z.B. summaryInText) dürfen NICHT im Frontmatter landen.
       */
      const frontmatterKeys = new Set(template.metadata.fields.map((f) => f.key))
      const frontmatterMetadata: Record<string, unknown> = {}
      for (const key of frontmatterKeys) {
        if (key in metadataWithImages) frontmatterMetadata[key] = metadataWithImages[key]
      }

      applyEventFrontmatterDefaults({
        frontmatterKeys,
        frontmatter: frontmatterMetadata,
        typeId,
        ownerId,
        detailViewType,
        generateUuid: () => crypto.randomUUID(),
      })

      // Preset-Orchestrierung (Folge-Wizards):
      // Wird bewusst NICHT im Event-Formular ausgewählt, sondern im Template (Creation Flow).
      // Beim Erstellen eines Events schreiben wir die IDs als System-Felder in das Event-Frontmatter,
      // damit die Event-Detailseite Flow B/C verlinken kann.
      const docTypeAfterDefaults = typeof frontmatterMetadata.docType === 'string' ? frontmatterMetadata.docType.trim().toLowerCase() : ''
      if (docTypeAfterDefaults === 'event') {
        const fw = template.creation?.followWizards
        const testimonialId = typeof fw?.testimonialTemplateId === 'string' ? fw.testimonialTemplateId.trim() : ''
        const finalizeId = typeof fw?.finalizeTemplateId === 'string' ? fw.finalizeTemplateId.trim() : ''

        if (testimonialId) {
          frontmatterMetadata.wizard_testimonial_template_id = testimonialId
        } else if (!frontmatterMetadata.wizard_testimonial_template_id) {
          frontmatterMetadata.wizard_testimonial_template_id = 'event-testimonial-creation-de'
        }

        if (finalizeId) {
          frontmatterMetadata.wizard_finalize_template_id = finalizeId
        } else if (!frontmatterMetadata.wizard_finalize_template_id) {
          frontmatterMetadata.wizard_finalize_template_id = 'event-finalize-de'
        }
      }
      
      // Auto-generiere dialograum_id wenn Feld vorhanden aber leer ist
      if (frontmatterKeys.has('dialograum_id') && (!frontmatterMetadata.dialograum_id || String(frontmatterMetadata.dialograum_id).trim() === '')) {
        // Generiere UUID-ähnliche ID (ohne Bindestriche für URL-Sicherheit)
        const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        frontmatterMetadata.dialograum_id = uuid
      }

      // Body: bevorzugt explizites Markdown (vom LLM oder manuell), sonst aus Template-Body rendern
      // WICHTIG: Wenn Template {{bodyInText}} enthält, sollte dieser aus aktuellen Metadaten neu generiert werden,
      // damit Änderungen an Feldern wie speakerName korrekt reflektiert werden.
      // Verwende metadataWithImages, damit Bild-URLs im Body verfügbar sind
      const templateBody = template.markdownBody || ""
      const hasBodyInTextPlaceholder = templateBody.includes('{{bodyInText')
      
      let finalBodyMarkdown = preferredMarkdown.trim().length > 0 && !hasBodyInTextPlaceholder
        ? preferredMarkdown
        : renderTemplateBody({ body: templateBody, values: metadataWithImages })

      // Füge Bild automatisch oben im Body ein (nach Teaser, falls vorhanden)
      // Finde das erste Bildfeld mit einer URL
      let firstImageUrl: string | undefined
      let firstImageKey: string | undefined
      for (const fieldKey of imageFieldKeysForSave) {
        const imageUrl = imageUrls[fieldKey] || metadataWithImages[fieldKey]
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
          firstImageUrl = imageUrl
          firstImageKey = fieldKey
          break
        }
      }

      if (firstImageUrl && firstImageKey) {
        // Suche nach Teaser im Markdown
        const teaserPattern = /(?:^|\n)(?:##\s+)?Teaser[:\s]*\n([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n##|$)/i
        const teaserMatch = finalBodyMarkdown.match(teaserPattern)
        
        if (teaserMatch) {
          // Teaser gefunden: Füge Bild direkt nach Teaser ein
          const teaserEnd = teaserMatch.index! + teaserMatch[0].length
          const beforeTeaser = finalBodyMarkdown.substring(0, teaserEnd)
          const afterTeaser = finalBodyMarkdown.substring(teaserEnd)
          
          // Prüfe, ob Bild bereits vorhanden ist (verhindere Duplikate)
          const imageMarkdown = `\n\n![${firstImageKey}](${firstImageUrl})\n\n`
          if (!beforeTeaser.includes(firstImageUrl) && !afterTeaser.includes(firstImageUrl)) {
            finalBodyMarkdown = beforeTeaser + imageMarkdown + afterTeaser
          }
        } else {
          // Kein Teaser gefunden: Füge Bild ganz oben ein
          const imageMarkdown = `![${firstImageKey}](${firstImageUrl})\n\n`
          // Prüfe, ob Bild bereits vorhanden ist (verhindere Duplikate)
          if (!finalBodyMarkdown.includes(firstImageUrl)) {
            finalBodyMarkdown = imageMarkdown + finalBodyMarkdown
          }
        }
      }

      // Erweitere Frontmatter um Creation-Flow-Metadaten für Wiederherstellung
      // Diese Felder werden benötigt, um später wieder in den Flow einzusteigen
      const creationFlowMetadata: Record<string, unknown> = {}
      
      // Kanonische IDs für Resume (wichtig für zuverlässiges Wiederöffnen)
      creationFlowMetadata.creationTypeId = typeId
      creationFlowMetadata.creationTemplateId = template._id || templateId
      creationFlowMetadata.creationDetailViewType = resolveTemplateDetailViewType()
      
      // Template-Name: optional als lesbares Label (nicht mehr als primärer Key)
      const templateName = template.name || templateId
      creationFlowMetadata.templateName = templateName
      
      // Text Sources: Array der Text-Inhalte aus allen Quellen
      // Wird benötigt, um die ursprünglichen Eingaben wiederherzustellen
      const textSources: string[] = []
      for (const source of wizardState.sources) {
        if (source.kind === 'text' && source.text) {
          textSources.push(source.text)
        } else if (source.kind === 'url' && source.rawWebsiteText) {
          textSources.push(source.rawWebsiteText)
        } else if (source.kind === 'file' && source.extractedText) {
          textSources.push(source.extractedText)
        }
      }
      if (textSources.length > 0) {
        creationFlowMetadata.textSources = textSources
      }
      
      // Traceability-Felder für Dialograum-Ergebnis (wenn seedFileId vorhanden)
      const activeSeedFileId = seedFileIdState || seedFileId
      if (activeSeedFileId) {
        // Finde Dialograum-Source und Testimonial-Sources
        const dialograumSource = wizardState.sources.find(s => 
          s.kind === 'file' && 
          s.id === `file-${activeSeedFileId}`
        )
        const testimonialSources = wizardState.sources.filter(s => 
          s.kind === 'file' && 
          s.id !== `file-${seedFileId}` &&
          s.id.startsWith('file-')
        )
        
        // Extrahiere dialograum_id aus Dialograum-Source (falls verfügbar)
        if (dialograumSource) {
          try {
            const dialograumItem = await provider.getItemById(activeSeedFileId)
            if (dialograumItem && activeSeedFileId) {
              const { blob } = await provider.getBinary(activeSeedFileId)
              const content = await blob.text()
              const { meta } = parseFrontmatter(content)
              const dialograumId = typeof meta.dialograum_id === 'string' ? meta.dialograum_id.trim() : undefined
              
              if (dialograumId && frontmatterKeys.has('dialograum_id')) {
                frontmatterMetadata.dialograum_id = dialograumId
              }
            }
          } catch (error) {
            console.error('[handleSave] Fehler beim Laden der Dialograum-Datei für Traceability:', error)
          }
        }
        
        // Setze source_dialog_file_id und source_testimonial_file_ids
        if (frontmatterKeys.has('source_dialog_file_id')) {
          frontmatterMetadata.source_dialog_file_id = activeSeedFileId
        }

        // Setze source_event_file_id (für Event-Testimonial- und Event-Finalize-Flows)
        if (frontmatterKeys.has('source_event_file_id')) {
          frontmatterMetadata.source_event_file_id = activeSeedFileId
        }

        // Setze originalFileId (für Final-Drafts), wenn das Template dieses Feld kennt
        if (frontmatterKeys.has('originalFileId')) {
          frontmatterMetadata.originalFileId = activeSeedFileId
        }

        // Wenn Seed ein Event ist, übernehme dessen slug (damit Final-Drafts denselben Explorer-Slug nutzen können)
        if (frontmatterKeys.has('slug')) {
          try {
            const { blob } = await provider.getBinary(activeSeedFileId)
            const content = await blob.text()
            const { meta } = parseFrontmatter(content)
            const seedSlug = typeof meta.slug === 'string' ? meta.slug.trim() : ''
            if (seedSlug) {
              frontmatterMetadata.slug = seedSlug
            }
          } catch (error) {
            console.error('[handleSave] Fehler beim Laden der Seed-Datei für slug:', error)
          }
        }

        // Finalize-Wizard: Setze finalRunId und eventStatus
        const isEventFinalize = (templateId || '').toLowerCase() === 'event-finalize-de'
        if (isEventFinalize) {
          if (frontmatterKeys.has('finalRunId')) {
            // Importiere toEventRunId dynamisch (Client-seitig)
            const { toEventRunId } = await import('@/lib/events/event-run-id-client')
            frontmatterMetadata.finalRunId = toEventRunId()
          }
          if (frontmatterKeys.has('eventStatus') && !frontmatterMetadata.eventStatus) {
            frontmatterMetadata.eventStatus = 'finalDraft'
          }
        }
        
        if (frontmatterKeys.has('source_testimonial_file_ids')) {
          const testimonialFileIds = testimonialSources
            .map(s => {
              // Extrahiere fileId aus source.id (Format: "file-{fileId}")
              const match = s.id.match(/^file-(.+)$/)
              return match ? match[1] : null
            })
            .filter((id): id is string => id !== null)
          
          if (testimonialFileIds.length > 0) {
            frontmatterMetadata.source_testimonial_file_ids = testimonialFileIds
          }
        }
      }

      // Erstelle Markdown-Content mit Frontmatter (Template-Metadaten + Creation-Flow-Metadaten)
      const allFrontmatterMetadata = {
        ...frontmatterMetadata,
        ...creationFlowMetadata,
      }
      const docTypeForSave = typeof allFrontmatterMetadata.docType === 'string' ? allFrontmatterMetadata.docType.trim() : ''
      const slugForSave = typeof allFrontmatterMetadata.slug === 'string' ? allFrontmatterMetadata.slug.trim() : undefined
      
      const frontmatter = Object.entries(allFrontmatterMetadata)
        .map(([key, value]) => {
          if (value === null || value === undefined) {
            return `${key}: ""`
          }
          if (Array.isArray(value)) {
            return `${key}: ${JSON.stringify(value)}`
          }
          if (typeof value === 'string' && value.includes('\n')) {
            return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`
          }
          return `${key}: ${value}`
        })
        .join("\n")

      const markdownContent = `---\n${frontmatter}\n---\n\n${finalBodyMarkdown}`

      // Speichere Datei im Storage
      let targetFolderId: string
      let targetFileName: string
      // WICHTIG: Wird weiter unten für Session-Finalisierung verwendet.
      // Muss hier deklariert sein, sonst gibt es zur Laufzeit "savedItemId is not defined".
      let savedItemId: string | undefined

      /**
       * PDF-Shadow‑Twin Publish (Contract-Update):
       * - KEINE zusätzliche "finale" Datei erzeugen.
       * - Stattdessen: Transformationsdatei im Shadow‑Twin (`*.{templateId}.de.md`) überschreiben
       *   (Frontmatter aus editDraft, Body bleibt aus dem Transformationsartefakt).
       * - Danach: Artefakte aus `.wizard-sources` in den Zielordner promoten (Variante C).
       * - Danach: explizit "publizieren" = ingest (RAG) via ingest-markdown.
       */
      const isPdfShadowTwinPublish =
        (templateId || '').toLowerCase() === 'pdfanalyse' &&
        !!wizardState.pdfBaseFileId &&
        !!wizardState.pdfTransformFileId &&
        !!libraryId

      if (isPdfShadowTwinPublish) {
        const libId = libraryId!
        const destinationFolderId = currentFolderId && currentFolderId.trim().length > 0 ? currentFolderId : 'root'

        // 1) Promote (damit wir im Zielpfad arbeiten; IDs können sich durch move ändern)
        const promotion = await promoteWizardArtifacts({
          provider,
          baseFileId: wizardState.pdfBaseFileId!,
          destinationFolderId,
        })

        if (!promotion.destinationBaseFileId) {
          throw new Error('PDF-Publish: destinationBaseFileId fehlt nach Promotion.')
        }

        const baseFileName = promotion.baseFileName
        const artifactFolderId = promotion.destinationArtifactFolderId
        if (!baseFileName || !artifactFolderId) {
          throw new Error('PDF-Publish: Artefakt-Ordner konnte im Zielordner nicht gefunden werden.')
        }

        // 2) Transformationsdatei im (neuen) Shadow‑Twin finden (zentral über Resolver)
        const resolvedTransform = await resolveArtifactClient({
          libraryId: libId,
          sourceId: promotion.destinationBaseFileId,
          sourceName: baseFileName,
          parentId: destinationFolderId,
          targetLanguage: 'de',
          templateName: String(templateId || 'pdfanalyse'),
          preferredKind: 'transformation',
        })
        if (!resolvedTransform?.fileId) {
          throw new Error('PDF-Publish: Transformationsdatei fehlt im Shadow‑Twin (resolveArtifact).')
        }
        const transformItem = await provider.getItemById(resolvedTransform.fileId)
        if (!transformItem) {
          throw new Error('PDF-Publish: Transformationsdatei konnte nicht geladen werden (getItemById).')
        }

        // 3) Body aus Transformationsartefakt behalten, nur Frontmatter ersetzen
        const { blob: existingTransformBlob } = await provider.getBinary(transformItem.id)
        const existingTransformContent = await existingTransformBlob.text()
        const { body: existingTransformBody } = parseFrontmatter(existingTransformContent)

        // Für PDF-Publish halten wir das Frontmatter bewusst sauber:
        // nur Template-Metadaten (keine Wizard-Resume-Felder).
        const pdfFrontmatter = Object.entries(frontmatterMetadata)
          .map(([key, value]) => {
            if (value === null || value === undefined) return `${key}: ""`
            if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`
            if (typeof value === 'string' && value.includes('\n')) {
              return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`
            }
            return `${key}: ${value}`
          })
          .join("\n")

        const pdfMarkdownContent = `---\n${pdfFrontmatter}\n---\n\n${existingTransformBody}`

        // 4) Overwrite via zentralem Writer (SSOT, v2-only)
        const templateName = String(templateId || 'pdfanalyse')
        const writeRes = await writeArtifact(provider, {
          key: {
            sourceId: promotion.destinationBaseFileId,
            kind: 'transformation',
            targetLanguage: 'de',
            templateName,
          },
          sourceName: baseFileName,
          parentId: destinationFolderId,
          content: pdfMarkdownContent,
          createFolder: true,
        })
        const updatedTransformFile = writeRes.file

        savedItemId = updatedTransformFile.id
        targetFolderId = destinationFolderId
        targetFileName = updatedTransformFile.metadata?.name

        // 5) Refresh Zielordner
        await refreshItems(destinationFolderId)

        // 5b) Log file_saved (PDF-Publish)
        if (wizardSessionIdRef.current) {
          try {
            const filePaths = await getFilePaths(provider, {
              savedItemId: updatedTransformFile.id,
              transformFileId: updatedTransformFile.id,
              baseFileId: promotion.destinationBaseFileId,
              transcriptFileId: wizardState.pdfTranscriptFileId,
            })
            await logWizardEvent(wizardSessionIdRef.current, {
              eventType: 'file_saved',
              fileIds: {
                savedItemId: updatedTransformFile.id,
                transformFileId: updatedTransformFile.id,
                baseFileId: promotion.destinationBaseFileId,
                transcriptFileId: wizardState.pdfTranscriptFileId,
              },
              filePaths,
            })
          } catch (error) {
            console.warn('[Wizard] Fehler beim Loggen von file_saved (PDF):', error)
          }
        }

        // 6) Publizieren (Ingestion) explizit beim Speichern
        const ingestRes = await fetch(`/api/chat/${libId}/ingest-markdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: updatedTransformFile.id,
            fileName: targetFileName,
          }),
        })
        if (!ingestRes.ok) {
          const errorText = await ingestRes.text().catch(() => 'Unknown error')
          // Nicht fatal für "Datei ist gespeichert", aber wichtig als Feedback
          toast.warning(`Gespeichert, aber Ingestion fehlgeschlagen: ${errorText}`)
        }

        toast.success('Gespeichert & publiziert (Shadow‑Twin aktualisiert).')
      }
      
      if (resumeFileIdState) {
        // Resume-Modus: Überschreibe bestehende Datei (delete + upload)
        try {
          // Lade bestehende Datei, um parentId zu bekommen
          const existingItem = await provider.getItemById(resumeFileIdState)
          if (!existingItem) {
            throw new Error("Bestehende Datei nicht gefunden")
          }
          
          targetFolderId = existingItem.parentId || "root"
          targetFileName = existingItem.metadata.name
          
          // Lösche alte Datei
          await provider.deleteItem(resumeFileIdState)
          
          // Lade neue Datei hoch
          const file = new File([markdownContent], targetFileName, { type: "text/markdown" })
          const uploadedItem = await provider.uploadFile(targetFolderId, file)
          savedItemId = uploadedItem.id
          
          toast.success("Datei erfolgreich aktualisiert!")
          
          // Log file_saved Event (Resume)
          if (wizardSessionIdRef.current) {
            try {
              const filePaths = await getFilePaths(provider, {
                savedItemId: uploadedItem.id,
                transformFileId: wizardState.pdfTransformFileId,
                baseFileId: wizardState.pdfBaseFileId,
                transcriptFileId: wizardState.pdfTranscriptFileId,
              })
              await logWizardEvent(wizardSessionIdRef.current, {
                eventType: 'file_saved',
                fileIds: {
                  savedItemId: uploadedItem.id,
                  transformFileId: wizardState.pdfTransformFileId,
                  baseFileId: wizardState.pdfBaseFileId,
                  transcriptFileId: wizardState.pdfTranscriptFileId,
                },
                filePaths,
              })
            } catch (error) {
              console.warn('[Wizard] Fehler beim Loggen von file_saved:', error)
            }
          }
        } catch (error) {
          toast.error(`Fehler beim Aktualisieren: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
          throw error
        }
      } else {
        // Normal-Modus: Neue Datei erstellen
        const isEventFinalize = (templateId || '').toLowerCase() === 'event-finalize-de'
        const createInOwnFolder = creation.output?.createInOwnFolder === true
        
        // Finalize-Wizard: Speichere in finals/run-<runId>/event-final.md
        if (isEventFinalize && seedFileIdState) {
          try {
            // Lade Event-Datei, um den Event-Ordner zu finden
            const eventItem = await provider.getItemById(seedFileIdState)
            if (!eventItem) throw new Error('Event-Datei nicht gefunden')
            const eventFolderId = eventItem.parentId || 'root'
            
            // Erstelle finals-Ordner (falls nicht vorhanden)
            const baseItems = await provider.listItemsById(eventFolderId)
            let finalsFolder = baseItems.find(item => item.type === 'folder' && item.metadata.name === 'finals')
            if (!finalsFolder) {
              finalsFolder = await provider.createFolder(eventFolderId, 'finals')
            }
            
            // Erstelle run-<runId> Ordner
            const { toEventRunId } = await import('@/lib/events/event-run-id-client')
            const runId = toEventRunId()
            const runFolderName = runId // z.B. "run-20260114-143022"
            const runItems = await provider.listItemsById(finalsFolder.id)
            let runFolder = runItems.find(item => item.type === 'folder' && item.metadata.name === runFolderName)
            if (!runFolder) {
              runFolder = await provider.createFolder(finalsFolder.id, runFolderName)
            }
            
            // Speichere event-final.md im run-Ordner
            targetFolderId = runFolder.id
            targetFileName = 'event-final.md'
            const file = new File([markdownContent], targetFileName, { type: "text/markdown" })
            const uploadedItem = await provider.uploadFile(targetFolderId, file)
            savedItemId = uploadedItem.id
            
            toast.success(`Final-Draft erstellt in ${runFolderName}/event-final.md`)
            
            // Log file_saved Event (Finalize-Modus)
            if (wizardSessionIdRef.current) {
              try {
                const filePaths = await getFilePaths(provider, {
                  savedItemId: uploadedItem.id,
                  transformFileId: wizardState.pdfTransformFileId,
                  baseFileId: wizardState.pdfBaseFileId,
                  transcriptFileId: wizardState.pdfTranscriptFileId,
                })
                await logWizardEvent(wizardSessionIdRef.current, {
                  eventType: 'file_saved',
                  fileIds: {
                    savedItemId: uploadedItem.id,
                    transformFileId: wizardState.pdfTransformFileId,
                    baseFileId: wizardState.pdfBaseFileId,
                    transcriptFileId: wizardState.pdfTranscriptFileId,
                  },
                  filePaths,
                })
              } catch (error) {
                console.warn('[Wizard] Fehler beim Loggen von file_saved:', error)
              }
            }
          } catch (error) {
            toast.error(`Fehler beim Erstellen des Final-Drafts: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
            throw error
          }
        } else if (createInOwnFolder) {
          // Container-Modus: Ordner erstellen und Source-Datei darin speichern
          // Ordnername = Dateiname ohne Extension (z.B. "mein-event")
          const folderName = fileName.replace(/\.[^.]+$/, '') // Entferne Extension
          const sourceFileName = fileName // Source-Datei heißt wie Ordner: "mein-event/mein-event.md"
          
          // Erstelle Ordner (falls nicht vorhanden)
          try {
            // Prüfe, ob Ordner bereits existiert
            const existingItems = await provider.listItemsById(currentFolderId || "root")
            const existingFolder = existingItems.find(
              item => item.type === 'folder' && item.metadata.name === folderName
            )
            
            if (existingFolder) {
              // Ordner existiert bereits → nutze ihn
              targetFolderId = existingFolder.id
            } else {
              // Erstelle neuen Ordner
              const folderItem = await provider.createFolder(currentFolderId || "root", folderName)
              targetFolderId = folderItem.id
            }
            
            // Speichere Source-Datei im Ordner
            targetFileName = sourceFileName
            const file = new File([markdownContent], targetFileName, { type: "text/markdown" })
            const uploadedItem = await provider.uploadFile(targetFolderId, file)
            savedItemId = uploadedItem.id
            
            toast.success(`Content erfolgreich erstellt in Ordner "${folderName}"!`)
            
            // Log file_saved Event (Container-Modus)
            if (wizardSessionIdRef.current) {
              try {
                const filePaths = await getFilePaths(provider, {
                  savedItemId: uploadedItem.id,
                  transformFileId: wizardState.pdfTransformFileId,
                  baseFileId: wizardState.pdfBaseFileId,
                  transcriptFileId: wizardState.pdfTranscriptFileId,
                })
                await logWizardEvent(wizardSessionIdRef.current, {
                  eventType: 'file_saved',
                  fileIds: {
                    savedItemId: uploadedItem.id,
                    transformFileId: wizardState.pdfTransformFileId,
                    baseFileId: wizardState.pdfBaseFileId,
                    transcriptFileId: wizardState.pdfTranscriptFileId,
                  },
                  filePaths,
                })
              } catch (error) {
                console.warn('[Wizard] Fehler beim Loggen von file_saved:', error)
              }
            }
          } catch (error) {
            toast.error(`Fehler beim Erstellen des Ordners: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
            throw error
          }
        } else {
          // Standard-Modus: Datei direkt im aktuellen Ordner speichern
          targetFolderId = currentFolderId && currentFolderId.trim().length > 0 ? currentFolderId : "root"
          targetFileName = fileName
          const file = new File([markdownContent], targetFileName, { type: "text/markdown" })
          const uploadedItem = await provider.uploadFile(targetFolderId, file)
          savedItemId = uploadedItem.id
          
          toast.success("Content erfolgreich erstellt!")
          
          // Log file_saved Event (Standard-Modus)
          if (wizardSessionIdRef.current) {
            try {
              const filePaths = await getFilePaths(provider, {
                savedItemId: uploadedItem.id,
                transformFileId: wizardState.pdfTransformFileId,
                baseFileId: wizardState.pdfBaseFileId,
                transcriptFileId: wizardState.pdfTranscriptFileId,
              })
              await logWizardEvent(wizardSessionIdRef.current, {
                eventType: 'file_saved',
                fileIds: {
                  savedItemId: uploadedItem.id,
                  transformFileId: wizardState.pdfTransformFileId,
                  baseFileId: wizardState.pdfBaseFileId,
                  transcriptFileId: wizardState.pdfTranscriptFileId,
                },
                filePaths,
              })
            } catch (error) {
              console.warn('[Wizard] Fehler beim Loggen von file_saved:', error)
            }
          }
        }
      }

      // save_completed (zusätzlich zu file_saved) – zeigt klar Ende des Speichervorgangs
      if (sessionIdForLogs && savedItemId) {
        const durationMs = Math.max(0, nowMs() - saveStartedAt)
        void logWizardEventClient(sessionIdForLogs, {
          eventType: 'save_completed',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStep?.preset,
          fileIds: { savedItemId },
          metadata: { durationMs },
        })
      }
      
      // Wichtig: refreshItems erwartet eine folderId. Ohne Parameter entsteht fileId=undefined im Request.
      // PDF-Publish erledigt refresh/promotion bereits im eigenen Branch (sonst doppelte moves/Logs).
      if (!isPdfShadowTwinPublish) {
        await refreshItems(targetFolderId)

        // Variante C: Staging-Artefakte aus `.wizard-sources` in den Zielordner verschieben
        // (best effort, kein Blocker für Speichern)
        await promotePdfWizardArtifacts({ destinationFolderId: targetFolderId })
      }

      /**
       * Flow A (Event) – Publizieren via Ingestion beim Speichern:
       * Explorer/Gallery hängt am Ingestion-Index. Für Events wollen wir daher nach dem Speichern
       * explizit ingestieren (analog zu PDF-Publish, aber ohne Shadow‑Twin Override).
       *
       * Testimonials sind in diesem Projekt bewusst filesystem-only; daher ingestieren wir nur docType=event.
       */
      const hasPublishStep = !!template.creation?.flow?.steps?.some((s) => s.preset === 'publish')
      const shouldIngestEvent = (opts?.ingestEvent !== undefined) ? opts.ingestEvent : !hasPublishStep
      if (shouldIngestEvent && !isPdfShadowTwinPublish && docTypeForSave === 'event' && libraryId && savedItemId) {
        const libId = libraryId
        const ingestStartedAt = nowMs()
        if (sessionIdForLogs) {
          void logWizardEventClient(sessionIdForLogs, {
            eventType: 'ingest_started',
            stepIndex: wizardState.currentStepIndex,
            stepPreset: currentStep?.preset,
            fileIds: { savedItemId },
          })
        }

        // Wichtig: nicht blockieren (sonst wirkt "Speichern" wie "hängt"),
        // aber im wizard_sessions Log ist die Reihenfolge trotzdem sichtbar.
        void fetch(`/api/chat/${encodeURIComponent(libId)}/ingest-markdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: savedItemId,
            fileName: targetFileName,
          }),
        })
          .then(async (ingestRes) => {
            if (!sessionIdForLogs) return
            const durationMs = Math.max(0, nowMs() - ingestStartedAt)
            if (ingestRes.ok) {
              void logWizardEventClient(sessionIdForLogs, {
                eventType: 'ingest_completed',
                stepIndex: wizardState.currentStepIndex,
                stepPreset: currentStep?.preset,
                fileIds: { savedItemId },
                metadata: { durationMs },
              })
              return
            }
            const errorText = await ingestRes.text().catch(() => 'Unknown error')
            void logWizardEventClient(sessionIdForLogs, {
              eventType: 'ingest_failed',
              stepIndex: wizardState.currentStepIndex,
              stepPreset: currentStep?.preset,
              fileIds: { savedItemId },
              metadata: { durationMs },
              error: { code: 'ingest_failed', message: errorText },
            })
          })
          .catch((error) => {
            if (!sessionIdForLogs) return
            const durationMs = Math.max(0, nowMs() - ingestStartedAt)
            void logWizardEventClient(sessionIdForLogs, {
              eventType: 'ingest_failed',
              stepIndex: wizardState.currentStepIndex,
              stepPreset: currentStep?.preset,
              fileIds: { savedItemId },
              metadata: { durationMs },
              error: { code: 'ingest_failed', message: error instanceof Error ? error.message : String(error) },
            })
          })
      }
      
      // Schreibe Shadow‑Twin Bundle (falls Quellen vorhanden)
      if (!isPdfShadowTwinPublish && wizardState.sources.length > 0 && wizardState.generatedDraft) {
        try {
          // Lade die gerade gespeicherte Datei, um ihre ID zu bekommen
          const items = await provider.listItemsById(targetFolderId)
          const savedFile = items.find(
            item => item.type === 'file' && item.metadata.name === targetFileName
          )
          
          if (savedFile) {
            // Baue Transcript-Inhalt (vollständiger Rohkorpus)
            const transcriptContent = buildCorpusText(wizardState.sources)
            
            // Baue Transformation-Inhalt (Template-Output mit Frontmatter)
            const transformationContent = `---\n${Object.entries(wizardState.generatedDraft.metadata)
              .map(([key, value]) => {
                if (value === null || value === undefined) return `${key}: ""`
                if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`
                if (typeof value === 'string' && value.includes('\n')) {
                  return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`
                }
                return `${key}: ${value}`
              })
              .join('\n')}\n---\n\n${wizardState.generatedDraft.markdown}`
            
            // Rufe write-bundle API auf
            const bundleResponse = await fetch(`/api/library/${libraryId}/creation/write-bundle`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sourceFileId: savedFile.id,
                sourceFileName: targetFileName,
                sourceParentId: targetFolderId,
                // Serialisiere sources: Date-Objekte zu ISO-Strings
                sources: wizardState.sources.map(source => ({
                  ...source,
                  createdAt: source.createdAt.toISOString(),
                })),
                transcriptContent,
                transformationContent,
                templateName: template.name || templateId,
                targetLanguage: 'de',
              }),
            })
            
            if (!bundleResponse.ok) {
              const errorText = await bundleResponse.text().catch(() => 'Unknown error')
              let errorData: unknown
              try {
                errorData = JSON.parse(errorText)
              } catch {
                errorData = { error: errorText }
              }
              console.error('[handleSave] Fehler beim Schreiben des Bundles:', {
                status: bundleResponse.status,
                statusText: bundleResponse.statusText,
                errorData,
              })
              // Nicht fatal: Source-Datei ist bereits gespeichert
              const errorMessage = typeof errorData === 'object' && errorData !== null && 'error' in errorData
                ? String(errorData.error)
                : 'Unbekannter Fehler'
              toast.warning(`Shadow‑Twin Bundle konnte nicht geschrieben werden: ${errorMessage}`)
            } else {
              const bundleResult = await bundleResponse.json()
              // Optional: Aktualisiere Source-Datei mit Referenz-IDs im Frontmatter
              // (Für jetzt: Referenzen werden später über Resolver aufgelöst)
              if (bundleResult.transcriptFileId || bundleResult.transformationFileId) {
                // TODO: Optional: Frontmatter mit Referenzen aktualisieren
                // Für jetzt: Resolver findet Artefakte automatisch
              }
            }
          }
        } catch (error) {
          console.error('[handleSave] Fehler beim Schreiben des Bundles:', error)
          // Nicht fatal: Source-Datei ist bereits gespeichert
          toast.warning('Shadow‑Twin Bundle konnte nicht geschrieben werden, aber Source-Datei wurde gespeichert')
        }
      }
      
      // Ermittle savedItemId für Logging (falls noch nicht gesetzt)
      if (!savedItemId) {
        try {
          const items = await provider.listItemsById(targetFolderId)
          const savedFile = items.find(
            item => item.type === 'file' && item.metadata.name === targetFileName
          )
          savedItemId = savedFile?.id
        } catch {
          // Ignoriere Fehler
        }
      }
      
      const shouldFinalizeSession = opts?.finalizeSession !== false

      // Finalize Wizard Session (wizard_completed)
      if (shouldFinalizeSession && wizardSessionIdRef.current && savedItemId) {
        try {
          const filePaths = await getFilePaths(provider, {
            savedItemId,
            transformFileId: wizardState.pdfTransformFileId,
            baseFileId: wizardState.pdfBaseFileId,
            transcriptFileId: wizardState.pdfTranscriptFileId,
          })

          await logWizardEvent(wizardSessionIdRef.current, {
            eventType: 'wizard_completed',
            stepIndex: wizardState.currentStepIndex,
            stepPreset: currentStep.preset,
            fileIds: {
              savedItemId,
              transformFileId: wizardState.pdfTransformFileId,
              baseFileId: wizardState.pdfBaseFileId,
              transcriptFileId: wizardState.pdfTranscriptFileId,
            },
            filePaths,
          })

          wizardSessionCompletedRef.current = true
          await finalizeWizardSessionClient(wizardSessionIdRef.current, 'completed', {
            finalStepIndex: wizardState.currentStepIndex,
            finalFileIds: {
              savedItemId,
              transformFileId: wizardState.pdfTransformFileId,
            },
            finalFilePaths: {
              savedPath: filePaths.savedPath,
              transformPath: filePaths.transformPath,
            },
          })
        } catch (error) {
          console.warn('[Wizard] Fehler beim Finalisieren der Session:', error)
        }
      }
      
      if (opts?.navigateToLibrary !== false) {
        // UX: Wenn wir wissen, in welchem Ordner gespeichert wurde, direkt dorthin navigieren.
        const folderParam = targetFolderId ? `?folderId=${encodeURIComponent(targetFolderId)}` : ''
        router.push(`/library${folderParam}`)
      }

      return { savedItemId, fileName: targetFileName, targetFolderId, slug: slugForSave }
    } catch (error) {
      // Log error Event
      if (wizardSessionIdRef.current) {
        try {
          await logWizardEvent(wizardSessionIdRef.current, {
            eventType: 'error',
            error: {
              code: 'save_failed',
              message: error instanceof Error ? error.message : 'Unbekannter Fehler',
            },
          })
        } catch (logError) {
          console.warn('[Wizard] Fehler beim Loggen von error:', logError)
        }
      }
      
      // save_failed (zusätzlich zu error)
      if (sessionIdForLogs) {
        const durationMs = Math.max(0, nowMs() - saveStartedAt)
        void logWizardEventClient(sessionIdForLogs, {
          eventType: 'save_failed',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStep?.preset,
          metadata: { durationMs },
          error: {
            code: 'save_failed',
            message: error instanceof Error ? error.message : 'Unbekannter Fehler',
          },
        })
      }
      toast.error(`Fehler beim Speichern: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      return undefined
    }
  }
  
  const renderStep = () => {
    switch (currentStep.preset) {
      case "welcome": {
        const fallbackTitle = creation.ui?.displayName || template.name || "Vorlage"
        const welcomeMarkdown =
          creation.welcome?.markdown?.trim()
            ? creation.welcome.markdown
            : `## Willkommen\n\nHier erstellen wir gemeinsam **${fallbackTitle}**.\n\n- Du wählst eine Methode (erzählen, Webseite, Text, Datei oder Formular)\n- Wir erstellen einen ersten Vorschlag\n- Du prüfst kurz und speicherst\n`

        return (
          <WelcomeStep
            title={currentStep.title || "Willkommen"}
            markdown={welcomeMarkdown}
          />
        )
      }


      case "collectSource":
        return (
          <CollectSourceStep
            source={wizardState.selectedSource}
            mode={wizardState.mode}
            // Legacy: Fallback für altes System
            onCollect={(content) => {
              setWizardState(prev => ({
                ...prev,
                collectedInput: {
                  type: wizardState.selectedSource!.type,
                  content,
                },
              }))
            }}
            onCollectStructured={(result) => {
              setWizardState(prev => ({
                ...prev,
                generatedDraft: {
                  metadata: result.metadata,
                  markdown: result.markdown || "",
                },
              }))
            }}
            collectedInput={wizardState.collectedInput?.content}
            // Multi-Source: Neue Props
            sources={wizardState.sources}
            onAddSource={addSource}
            onRemoveSource={removeSource}
            isExtracting={wizardState.isExtracting}
            processingProgress={wizardState.processingProgress}
            processingMessage={wizardState.processingMessage}
            templateId={templateId}
            libraryId={libraryId}
            provider={provider || undefined}
            targetFolderId={currentFolderId}
            // Quelle-Auswahl (wenn source nicht gesetzt)
            supportedSources={creation.supportedSources}
            selectedSource={wizardState.selectedSource}
            onSourceSelect={(source) => {
              setWizardState(prev => ({ ...prev, selectedSource: source }))
            }}
            onModeSelect={(mode) => {
              setWizardState(prev => ({
                ...prev,
                mode,
                selectedSource: mode === 'form' ? undefined : prev.selectedSource,
                collectedInput: mode === 'form' ? undefined : prev.collectedInput,
              }))
            }}
            template={template}
            steps={steps}
            onCanProceedChange={setCollectSourceCanProceed}
          />
        )

      case "reviewMarkdown":
        return (
          <ReviewMarkdownStep
            title={currentStep.title || "Markdown prüfen"}
            markdown={wizardState.draftText || ""}
            onMarkdownChange={(next) => setWizardState(prev => ({ ...prev, draftText: next }))}
            isConfirmed={!!wizardState.hasConfirmedMarkdown}
            onConfirmedChange={(next) => {
              setWizardState(prev => ({ ...prev, hasConfirmedMarkdown: next }))
              
              // Log markdown_confirmed Event
              if (next && wizardSessionIdRef.current) {
                logWizardEvent(wizardSessionIdRef.current, {
                  eventType: 'markdown_confirmed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep.preset,
                }).catch(error => console.warn('[Wizard] Fehler beim Loggen von markdown_confirmed:', error))
              }
            }}
            isProcessing={wizardState.isExtracting}
            processingProgress={wizardState.processingProgress}
            processingMessage={wizardState.processingMessage}
            provider={provider || null}
            currentFolderId={wizardState.pdfTranscriptFolderId || currentFolderId || 'root'}
          />
        )

      case "generateDraft":
        // Im Interview-Modus ist generateDraft zwingend nach collectSource
        // Im Form-Modus kann generateDraft optional sein
        // Finalize/Seed-Flows können ohne collectedInput arbeiten (Sources sind bereits gesetzt).
        if (wizardState.mode === 'interview' && !wizardState.collectedInput && wizardState.sources.length === 0) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Bitte zuerst Eingaben sammeln.
            </div>
          )
        }
        // Im Form-Modus kann generateDraft auch ohne collectedInput aufgerufen werden (z.B. zur Initialbefüllung)
        const inputForGeneration = wizardState.collectedInput?.content || buildCorpusText(wizardState.sources)
        return (
          <GenerateDraftStep
            templateId={templateId}
            libraryId={libraryId}
            input={inputForGeneration}
            onGenerateStarted={() => {
              const sessionId = wizardSessionIdRef.current
              if (!sessionId) return
              void logWizardEventClient(sessionId, {
                eventType: 'job_started',
                stepIndex: wizardState.currentStepIndex,
                stepPreset: currentStep?.preset,
                metadata: {
                  sourcesCount: wizardState.sources.length,
                  corpusLength: inputForGeneration.length,
                  templateId,
                },
              })
            }}
            onGenerate={(draft) => {
              setWizardState(prev => ({
                ...prev,
                generatedDraft: draft,
                // Im Form-Modus: Initialisiere draftMetadata und draftText aus generatedDraft
                draftMetadata: prev.mode === 'form' ? draft.metadata : prev.draftMetadata,
                draftText: prev.mode === 'form' ? draft.markdown : prev.draftText,
              }))
              const sessionId = wizardSessionIdRef.current
              if (!sessionId) return
              void logWizardEventClient(sessionId, {
                eventType: 'job_completed',
                stepIndex: wizardState.currentStepIndex,
                stepPreset: currentStep?.preset,
                metadata: {
                  sourcesCount: wizardState.sources.length,
                  corpusLength: inputForGeneration.length,
                  metadataKeys: Object.keys(draft.metadata || {}).length,
                  markdownLength: (draft.markdown || '').length,
                },
              })
            }}
            onGenerateFailed={(error) => {
              const sessionId = wizardSessionIdRef.current
              if (!sessionId) return
              const msg = error instanceof Error ? error.message : String(error)
              void logWizardEventClient(sessionId, {
                eventType: 'job_failed',
                stepIndex: wizardState.currentStepIndex,
                stepPreset: currentStep?.preset,
                error: { code: 'process_text_failed', message: msg },
              })
            }}
            generatedDraft={wizardState.generatedDraft}
          />
        )

      case "editDraft": {
        const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
        // Initialisiere draftMetadata/draftText falls noch nicht vorhanden
        const initialMetadata = wizardState.draftMetadata 
          || wizardState.reviewedFields 
          || wizardState.generatedDraft?.metadata 
          || {}
        const initialDraftText = wizardState.draftText 
          || wizardState.generatedDraft?.markdown 
          || ""
        
        // Feld-Auswahl: aus editDraft.fields (falls definiert)
        const userRelevantFields = currentStep.fields && currentStep.fields.length > 0
          ? currentStep.fields
          : undefined
        
        // PDF-HITL: Wenn wir hier ohne Draft landen, ist das ein Flow-Fehler (sonst sieht man "leere" Screens).
        if (isPdfAnalyse && Object.keys(initialMetadata).length === 0 && initialDraftText.trim().length === 0) {
          return (
            <Alert>
              <AlertTitle>Keine Metadaten vorhanden</AlertTitle>
              <AlertDescription>
                Es wurden noch keine Metadaten/Markdown erzeugt. Bitte gehe zurück und starte zuerst OCR (und danach Template/Metadaten).
              </AlertDescription>
            </Alert>
          )
        }

        // Wenn Felder definiert sind, zeige den Step auch bei leerem Metadata (User kann direkt eingeben)
        // Wenn keine Felder definiert sind UND Metadata leer ist, zeige Fehlermeldung
        if (!userRelevantFields && Object.keys(initialMetadata).length === 0) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Bitte zuerst Eingaben machen (URL/Text/Datei/Audio).
            </div>
          )
        }
        
        // Markdown-Tab nur anzeigen, wenn Text vorhanden ist
        const showMarkdownTab = initialDraftText.trim().length > 0
        
        // Bildfelder: aus editDraft.imageFieldKeys (falls definiert)
        const imageFieldKeys = currentStep.imageFieldKeys && currentStep.imageFieldKeys.length > 0
          ? currentStep.imageFieldKeys
          : undefined

        return (
          <EditDraftStep
            templateMetadata={template.metadata}
            draftMetadata={initialMetadata}
            draftText={initialDraftText}
            sources={wizardState.sources}
            // Nur benutzerrelevante Felder anzeigen (aus editDraft.fields)
            userRelevantFields={userRelevantFields}
            showMarkdownTab={showMarkdownTab}
            imageFieldKeys={imageFieldKeys}
            libraryId={libraryId}
            onMetadataChange={(metadata) => {
              setWizardState(prev => {
                // Extrahiere Bild-URLs (nur Strings)
                const newImageUrls: Record<string, string> = {}
                if (imageFieldKeys) {
                  for (const key of imageFieldKeys) {
                    const value = metadata[key]
                    if (typeof value === 'string' && value.trim().length > 0) {
                      newImageUrls[key] = value
                    }
                  }
                }
                return {
                  ...prev,
                  draftMetadata: metadata,
                  reviewedFields: metadata, // Synchronisiere auch reviewedFields
                  // Merge Bild-URLs auch in imageUrls für Preview
                  imageUrls: {
                    ...(prev.imageUrls || {}),
                    ...newImageUrls
                  }
                }
              })

              // DSGVO: nur Keys/Counts loggen, kein Inhalt
              scheduleMetadataEditedLog(metadata)
            }}
            onDraftTextChange={(text) => {
              setWizardState(prev => ({ ...prev, draftText: text }))
            }}
          />
        )
      }

      case "uploadImages": {
        // Bildfelder kommen aus dem aktuellen Step (fields)
        const imageFieldKeys = currentStep.fields || []
        
        if (imageFieldKeys.length === 0) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Keine Bildfelder konfiguriert. Bitte im Template-Editor Bildfelder für diesen Step auswählen.
            </div>
          )
        }

        // Konvertiere fieldKeys zu imageFields-Format für UploadImagesStep
        const imageFields = imageFieldKeys.map(key => ({
          key,
          label: template.metadata.fields.find(f => f.key === key)?.description || key,
        }))

        return (
          <UploadImagesStep
            imageFields={imageFields}
            selectedFiles={wizardState.imageFiles || {}}
            imageUrls={wizardState.imageUrls}
            isUploadingImages={wizardState.isUploadingImages}
            libraryId={libraryId}
            onChangeSelectedFiles={(key, file) => {
              setWizardState(prev => ({
                ...prev,
                imageFiles: {
                  ...(prev.imageFiles || {}),
                  [key]: file,
                },
                isUploadingImages: {
                  ...(prev.isUploadingImages || {}),
                  [key]: file !== null, // Upload startet wenn Datei ausgewählt
                },
              }))
            }}
            onUploadComplete={(key, url) => {
              setWizardState(prev => {
                const newImageUrls = {
                  ...(prev.imageUrls || {}),
                  [key]: url,
                }
                // Merge URLs in alle relevanten Metadata-Felder für Preview
                const baseMetadata = prev.draftMetadata || prev.reviewedFields || prev.generatedDraft?.metadata || {}
                const updatedMetadata = {
                  ...baseMetadata,
                  ...newImageUrls,
                }
                return {
                  ...prev,
                  imageUrls: newImageUrls,
                  draftMetadata: updatedMetadata,
                  // Merge auch in reviewedFields, falls vorhanden
                  reviewedFields: prev.reviewedFields ? {
                    ...prev.reviewedFields,
                    ...newImageUrls,
                  } : prev.reviewedFields,
                  isUploadingImages: {
                    ...(prev.isUploadingImages || {}),
                    [key]: false, // Upload abgeschlossen
                  },
                }
              })
            }}
          />
        )
      }

      case "selectRelatedTestimonials": {
        return (
          <SelectRelatedTestimonialsStep
            sources={wizardState.sources}
            onSelectionChange={handleTestimonialSelectionChange}
          />
        )
      }

      case "previewDetail": {
        const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
        const baseMetadata =
          wizardState.reviewedFields ||
          wizardState.generatedDraft?.metadata ||
          wizardState.draftMetadata ||
          {}
        
        // Merge Bild-URLs in baseMetadata für Preview
        const metadataWithImages = {
          ...baseMetadata,
          ...(wizardState.imageUrls || {}),
        }

        // UX/SSOT: Preview soll den korrekten docType anzeigen (z.B. Badge "Event").
        // Der docType wird sonst erst beim Speichern via applyEventFrontmatterDefaults gesetzt.
        // Für die Vorschau reichen Minimal-Heuristiken.
        const previewMetadata: Record<string, unknown> = { ...metadataWithImages }
        const currentDocType = typeof previewMetadata.docType === 'string' ? previewMetadata.docType.trim().toLowerCase() : ''
        const typeIdLower = String(typeId || '').toLowerCase()
        if (!currentDocType && typeIdLower.includes('event')) {
          previewMetadata.docType = 'event'
          // eventStatus ist optional, hilft aber beim UI-Labeling
          if (previewMetadata.eventStatus === undefined) previewMetadata.eventStatus = 'open'
        }
        
        const preferredPreviewMarkdown =
          wizardState.generatedDraft?.markdown ||
          wizardState.draftText ||
          ""

        // Wenn kein Markdown vorhanden ist, rendere es aus template.markdownBody (z.B. {{summaryInText}})
        let previewMarkdown =
          preferredPreviewMarkdown.trim().length > 0
            ? preferredPreviewMarkdown
            : renderTemplateBody({ body: template.markdownBody || "", values: metadataWithImages })

        // Füge Bild automatisch oben im Preview-Markdown ein (nach Teaser, falls vorhanden)
        const uploadImagesStep = creation?.flow.steps.find(step => step.preset === 'uploadImages')
        const imageFieldKeys = uploadImagesStep?.fields || []
        
        // Finde das erste Bildfeld mit einer URL
        let firstImageUrl: string | undefined
        let firstImageKey: string | undefined
        for (const fieldKey of imageFieldKeys) {
          const imageUrl = wizardState.imageUrls?.[fieldKey] || metadataWithImages[fieldKey]
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
            firstImageUrl = imageUrl
            firstImageKey = fieldKey
            break
          }
        }

        if (firstImageUrl && firstImageKey) {
          // Prüfe, ob Bild bereits im Markdown vorhanden ist
          if (!previewMarkdown.includes(firstImageUrl)) {
            // Suche nach Teaser im Markdown (verschiedene Formate)
            const teaserText = metadataWithImages.teaser as string | undefined
            let teaserMatch: RegExpMatchArray | null = null
            let teaserEnd = 0
            
            if (teaserText && typeof teaserText === 'string' && teaserText.trim().length > 0) {
              // Suche nach Teaser-Text im Markdown (erste 100 Zeichen für Matching)
              const teaserSnippet = teaserText.substring(0, 100).trim()
              const escapedSnippet = teaserSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const teaserPattern = new RegExp(`(${escapedSnippet})`, 'i')
              teaserMatch = previewMarkdown.match(teaserPattern)
              
              if (teaserMatch && teaserMatch.index !== undefined) {
                // Finde das Ende des Absatzes nach dem Teaser
                const afterTeaserStart = teaserMatch.index + teaserMatch[0].length
                const afterTeaser = previewMarkdown.substring(afterTeaserStart)
                const nextParagraphMatch = afterTeaser.match(/\n\n|\n##/)
                teaserEnd = nextParagraphMatch 
                  ? afterTeaserStart + nextParagraphMatch.index! + nextParagraphMatch[0].length
                  : afterTeaserStart + afterTeaser.length
              }
            }
            
            // Fallback: Suche nach "Teaser:" Label
            if (!teaserMatch) {
              const teaserLabelPattern = /(?:^|\n)(?:##\s+)?Teaser[:\s]*\n([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n##|$)/i
              const labelMatch = previewMarkdown.match(teaserLabelPattern)
              if (labelMatch && labelMatch.index !== undefined) {
                teaserEnd = labelMatch.index + labelMatch[0].length
                teaserMatch = labelMatch
              }
            }
            
            if (teaserMatch && teaserEnd > 0) {
              // Teaser gefunden: Füge Bild direkt nach Teaser ein
              const beforeTeaser = previewMarkdown.substring(0, teaserEnd)
              const afterTeaser = previewMarkdown.substring(teaserEnd)
              previewMarkdown = beforeTeaser + `\n\n![${firstImageKey}](${firstImageUrl})\n\n` + afterTeaser
            } else {
              // Kein Teaser gefunden: Füge Bild ganz oben ein
              previewMarkdown = `![${firstImageKey}](${firstImageUrl})\n\n` + previewMarkdown
            }
          }
        }

        const detailViewType = resolveTemplateDetailViewType()

        if (isPdfAnalyse && Object.keys(baseMetadata).length === 0 && preferredPreviewMarkdown.trim().length === 0) {
          return (
            <Alert>
              <AlertTitle>Keine Vorschau verfügbar</AlertTitle>
              <AlertDescription>
                Es gibt noch keine Metadaten/Markdown für die Vorschau. Bitte gehe zurück und führe zuerst OCR + Template aus.
              </AlertDescription>
            </Alert>
          )
        }

        if (Object.keys(baseMetadata).length === 0) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Bitte zuerst Daten ausfüllen oder auslesen.
            </div>
          )
        }

        return (
          <PreviewDetailStep
            detailViewType={detailViewType}
            metadata={previewMetadata}
            markdown={previewMarkdown}
            libraryId={libraryId}
            provider={provider}
            currentFolderId={wizardState.pdfTranscriptFolderId || currentFolderId || 'root'}
          />
        )
      }

      case "publish": {
        const onPublish = async () => {
          const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
          const isEventPublishFinal = (templateId || '').toLowerCase().includes('event-publish-final')
          const isEventFinalize = (templateId || '').toLowerCase() === 'event-finalize-de'
          const isGenericPublish = !isPdfAnalyse && !isEventPublishFinal && !isEventFinalize
          if (!isPdfAnalyse && !isEventPublishFinal && !isEventFinalize && !isGenericPublish) return
          if (!libraryId) throw new Error('libraryId fehlt')
          if (!template) throw new Error('Template ist nicht geladen')
          const libId = libraryId

          if (wizardState.isPublishing) return
          if (wizardState.isPublished) return

          const sessionIdForLogs = wizardSessionIdRef.current
          const publishStartedAt = nowMs()
          if (sessionIdForLogs) {
            void logWizardEventClient(sessionIdForLogs, {
              eventType: 'publish_started',
              stepIndex: wizardState.currentStepIndex,
              stepPreset: currentStep?.preset,
              metadata: {
                mode: isGenericPublish ? 'generic' : (isEventPublishFinal ? 'event_publish_final' : 'pdf_publish'),
              },
            })
          }

          // Generic Publish: Save + Ingest (z.B. Event-Erstellung).
          // Motivation: User soll am Ende einen expliziten Abschluss mit Progress sehen
          // und danach direkt in den Explorer wechseln können.
          if (isGenericPublish) {
            setWizardState(prev => ({
              ...prev,
              isPublishing: true,
              publishError: undefined,
              publishingProgress: 10,
              publishingMessage: 'Speichern…',
            }))
            try {
              const saveRes = await handleSave({ navigateToLibrary: false, ingestEvent: false, finalizeSession: false })
              const savedItemId = saveRes?.savedItemId
              const savedFileName = saveRes?.fileName
              const targetFolderId = saveRes?.targetFolderId
              const targetSlug = saveRes?.slug
              if (!savedItemId) throw new Error('Speichern fehlgeschlagen (savedItemId fehlt).')

              setWizardState(prev => ({
                ...prev,
                publishingProgress: 70,
                publishingMessage: 'Ingestion starten…',
              }))

              const ingestStartedAt = nowMs()
              if (sessionIdForLogs) {
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'ingest_started',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  fileIds: { savedItemId },
                  metadata: { mode: 'generic_publish' },
                })
              }
              const ingestRes = await fetch(`/api/chat/${encodeURIComponent(libId)}/ingest-markdown`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: savedItemId, fileName: savedFileName }),
              })
              if (!ingestRes.ok) {
                const errorText = await ingestRes.text().catch(() => 'Unknown error')
                if (sessionIdForLogs) {
                  const durationMs = Math.max(0, nowMs() - ingestStartedAt)
                  void logWizardEventClient(sessionIdForLogs, {
                    eventType: 'ingest_failed',
                    stepIndex: wizardState.currentStepIndex,
                    stepPreset: currentStep?.preset,
                    fileIds: { savedItemId },
                    metadata: { durationMs, mode: 'generic_publish' },
                    error: { code: 'ingest_failed', message: errorText },
                  })
                }
                throw new Error(`Ingestion fehlgeschlagen: ${errorText}`)
              }
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - ingestStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'ingest_completed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  fileIds: { savedItemId },
                  metadata: { durationMs, mode: 'generic_publish' },
                })
              }

              const imagesCount = Object.keys(wizardState.imageUrls || {}).length
              const sourcesCount = Array.isArray(wizardState.sources) ? wizardState.sources.length : 0

              setWizardState(prev => ({
                ...prev,
                isPublishing: false,
                isPublished: true,
                publishingProgress: 100,
                publishingMessage: 'Fertig.',
                publishStats: { documents: 1, images: imagesCount, sources: sourcesCount },
                publishTargetFolderId: targetFolderId,
                publishTargetSlug: targetSlug || prev.publishTargetSlug,
              }))
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - publishStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'publish_completed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  metadata: { durationMs, mode: 'generic' },
                })
              }

              // Wizard-Session erst ganz am Ende finalisieren (nach ingest/publish),
              // damit wizard_completed zeitlich korrekt ist.
              if (sessionIdForLogs) {
                try {
                  const filePaths = await getFilePaths(provider, { savedItemId })
                  await logWizardEventClient(sessionIdForLogs, {
                    eventType: 'wizard_completed',
                    stepIndex: wizardState.currentStepIndex,
                    stepPreset: 'publish',
                    fileIds: { savedItemId },
                    filePaths: { savedPath: filePaths.savedPath },
                  })
                  wizardSessionCompletedRef.current = true
                  await finalizeWizardSessionClient(sessionIdForLogs, 'completed', {
                    finalStepIndex: wizardState.currentStepIndex,
                    finalFileIds: { savedItemId },
                    finalFilePaths: { savedPath: filePaths.savedPath },
                  })
                } catch (error) {
                  console.warn('[Wizard] Fehler beim Finalisieren der Session (Generic Publish):', error)
                }
              }
              return
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
              setWizardState(prev => ({
                ...prev,
                isPublishing: false,
                publishError: msg,
                publishingProgress: prev.publishingProgress ?? 0,
                publishingMessage: msg,
              }))
              toast.error('Publizieren fehlgeschlagen', { description: msg })
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - publishStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'publish_failed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  metadata: { durationMs, mode: 'generic' },
                  error: { code: 'publish_failed', message: msg },
                })
              }
              return
            }
          }

          // Event Finalize Publish: Speichere Final-Draft, patche Frontmatter (eventStatus), dann Index-Swap
          if (isEventFinalize) {
            if (!seedFileIdState) throw new Error('Event-Finalize: seedFileId fehlt (Event-Datei nicht bekannt).')
            if (!provider) throw new Error('Provider fehlt')

            setWizardState(prev => ({
              ...prev,
              isPublishing: true,
              publishError: undefined,
              publishingProgress: 10,
              publishingMessage: 'Final-Draft speichern…',
            }))

            try {
              // 1) Speichere Final-Draft (falls noch nicht gespeichert)
              let finalFileId = resumeFileIdState
              if (!finalFileId) {
                const saveRes = await handleSave({ navigateToLibrary: false, ingestEvent: false, finalizeSession: false })
                finalFileId = saveRes?.savedItemId
                if (!finalFileId) throw new Error('Speichern fehlgeschlagen (savedItemId fehlt).')
              }

              setWizardState(prev => ({
                ...prev,
                publishingProgress: 40,
                publishingMessage: 'Frontmatter aktualisieren…',
              }))

              // 2) Lade Final-Datei und patche Frontmatter (eventStatus auf "closed")
              const { blob } = await provider.getBinary(finalFileId)
              const markdown = await blob.text()
              const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
              const patchedMarkdown = patchFrontmatter(markdown, { eventStatus: 'closed' })
              
              // 3) Überschreibe Datei mit gepatchtem Frontmatter
              const finalItem = await provider.getItemById(finalFileId)
              if (!finalItem) throw new Error('Final-Datei nicht gefunden')
              await provider.deleteItem(finalFileId)
              const file = new File([patchedMarkdown], finalItem.metadata.name || 'event-final.md', { type: 'text/markdown' })
              const uploadedItem = await provider.uploadFile(finalItem.parentId || 'root', file)
              finalFileId = uploadedItem.id

              setWizardState(prev => ({
                ...prev,
                publishingProgress: 70,
                publishingMessage: 'Final ingestieren + Index-Swap…',
              }))

              // 4) Rufe publish-final Endpoint auf (Index-Swap)
              const res = await fetch(`/api/library/${libId}/events/publish-final`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalFileId }),
              })
              const json = await res.json().catch(() => ({} as Record<string, unknown>))
              if (!res.ok) {
                const msg = typeof (json as { error?: unknown })?.error === 'string' ? String((json as { error: string }).error) : `HTTP ${res.status}`
                throw new Error(msg)
              }

              setWizardState(prev => ({
                ...prev,
                isPublishing: false,
                isPublished: true,
                publishingProgress: 100,
                publishingMessage: 'Fertig.',
              }))
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - publishStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'publish_completed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  metadata: { durationMs, mode: 'event_finalize' },
                })
              }

              // Wizard-Session finalisieren
              if (sessionIdForLogs) {
                try {
                  const filePaths = await getFilePaths(provider, { savedItemId: finalFileId })
                  await logWizardEventClient(sessionIdForLogs, {
                    eventType: 'wizard_completed',
                    stepIndex: wizardState.currentStepIndex,
                    stepPreset: 'publish',
                    fileIds: { savedItemId: finalFileId },
                    filePaths: { savedPath: filePaths.savedPath },
                  })
                  wizardSessionCompletedRef.current = true
                  await finalizeWizardSessionClient(sessionIdForLogs, 'completed', {
                    finalStepIndex: wizardState.currentStepIndex,
                    finalFileIds: { savedItemId: finalFileId },
                    finalFilePaths: { savedPath: filePaths.savedPath },
                  })
                } catch (error) {
                  console.warn('[Wizard] Fehler beim Finalisieren der Session (Event Finalize):', error)
                }
              }
              return
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
              setWizardState(prev => ({
                ...prev,
                isPublishing: false,
                publishError: msg,
                publishingProgress: prev.publishingProgress ?? 0,
                publishingMessage: msg,
              }))
              toast.error('Publizieren fehlgeschlagen', { description: msg })
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - publishStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'publish_failed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  metadata: { durationMs, mode: 'event_finalize' },
                  error: { code: 'publish_failed', message: msg },
                })
              }
              return
            }
          }

          // Event Publish Final (Legacy): Index-Swap (Final ingestieren, Original aus Index löschen).
          // Erwartung: Wizard wird als "Resume" auf einer Final-Datei gestartet.
          if (isEventPublishFinal) {
            const finalFileId = resumeFileIdState
            if (!finalFileId) throw new Error('Event-Publish: resumeFileId fehlt (Final-Datei nicht bekannt).')

            setWizardState(prev => ({
              ...prev,
              isPublishing: true,
              publishError: undefined,
              publishingProgress: 10,
              publishingMessage: 'Publizieren vorbereiten…',
            }))

            try {
              setWizardState(prev => ({
                ...prev,
                publishingProgress: 55,
                publishingMessage: 'Final ingestieren + Index-Swap…',
              }))

              const res = await fetch(`/api/library/${libId}/events/publish-final`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalFileId }),
              })
              const json = await res.json().catch(() => ({} as Record<string, unknown>))
              if (!res.ok) {
                const msg = typeof (json as { error?: unknown })?.error === 'string' ? String((json as { error: string }).error) : `HTTP ${res.status}`
                throw new Error(msg)
              }

              setWizardState(prev => ({
                ...prev,
                isPublishing: false,
                isPublished: true,
                publishingProgress: 100,
                publishingMessage: 'Fertig.',
              }))
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - publishStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'publish_completed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  metadata: { durationMs, mode: 'event_publish_final' },
                })
              }
              return
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
              setWizardState(prev => ({
                ...prev,
                isPublishing: false,
                publishError: msg,
                publishingProgress: prev.publishingProgress ?? 0,
                publishingMessage: msg,
              }))
              toast.error('Publizieren fehlgeschlagen', { description: msg })
              if (sessionIdForLogs) {
                const durationMs = Math.max(0, nowMs() - publishStartedAt)
                void logWizardEventClient(sessionIdForLogs, {
                  eventType: 'publish_failed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: currentStep?.preset,
                  metadata: { durationMs, mode: 'event_publish_final' },
                  error: { code: 'publish_failed', message: msg },
                })
              }
              return
            }
          }
          if (!provider) throw new Error('Kein Storage Provider verfügbar')

          const baseFileId = wizardState.pdfBaseFileId
          if (!baseFileId) throw new Error('PDF-Publish: pdfBaseFileId fehlt')

          // Metadaten: aus editDraft / reviewedFields / generatedDraft
          const baseMetadata =
            wizardState.draftMetadata
            || wizardState.reviewedFields
            || wizardState.generatedDraft?.metadata
            || {}

          // Frontmatter darf nur Template-Metadaten enthalten.
          const frontmatterKeys = new Set(template.metadata.fields.map((f) => f.key))
          const frontmatterMetadata: Record<string, unknown> = {}
          for (const key of frontmatterKeys) {
            if (key in baseMetadata) frontmatterMetadata[key] = (baseMetadata as Record<string, unknown>)[key]
          }

          function serializeFrontmatter(meta: Record<string, unknown>): string {
            return Object.entries(meta)
              .map(([key, value]) => {
                if (value === null || value === undefined) return `${key}: ""`
                if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`
                if (typeof value === 'string' && value.includes('\n')) {
                  return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`
                }
                return `${key}: ${value}`
              })
              .join("\n")
          }

          const destinationFolderId = currentFolderId && currentFolderId.trim().length > 0 ? currentFolderId : 'root'

          setWizardState(prev => ({
            ...prev,
            isPublishing: true,
            publishError: undefined,
            publishingProgress: 5,
            publishingMessage: 'Publizieren vorbereiten…',
          }))

          try {
            // 1) Promote (Variante C): `.wizard-sources` → Zielordner
            setWizardState(prev => ({
              ...prev,
              publishingProgress: 15,
              publishingMessage: 'Artefakte verschieben…',
            }))
            const promotion = await promoteWizardArtifacts({
              provider,
              baseFileId,
              destinationFolderId,
            })

            if (!promotion.destinationBaseFileId) {
              throw new Error('PDF-Publish: destinationBaseFileId fehlt nach Promotion.')
            }

            const baseFileName = promotion.baseFileName
            const artifactFolderId = promotion.destinationArtifactFolderId
            if (!baseFileName || !artifactFolderId) {
              throw new Error('PDF-Publish: Artefakt-Ordner konnte im Zielordner nicht gefunden werden.')
            }

            // 2) Transformationsdatei finden
            setWizardState(prev => ({
              ...prev,
              publishingProgress: 40,
              publishingMessage: 'Transformationsdatei finden…',
            }))
            const resolvedTransform = await resolveArtifactClient({
              libraryId: libId,
              sourceId: promotion.destinationBaseFileId,
              sourceName: baseFileName,
              parentId: destinationFolderId,
              targetLanguage: 'de',
              templateName: String(templateId || 'pdfanalyse'),
              preferredKind: 'transformation',
            })
            if (!resolvedTransform?.fileId) {
              throw new Error('PDF-Publish: Transformationsdatei fehlt im Shadow‑Twin (resolveArtifact).')
            }
            const transformItem = await provider.getItemById(resolvedTransform.fileId)
            if (!transformItem) {
              throw new Error('PDF-Publish: Transformationsdatei konnte nicht geladen werden (getItemById).')
            }

            // 3) Body behalten, Frontmatter überschreiben
            setWizardState(prev => ({
              ...prev,
              publishingProgress: 55,
              publishingMessage: 'Frontmatter aktualisieren…',
            }))
            const { blob: existingTransformBlob } = await provider.getBinary(transformItem.id)
            const existingTransformContent = await existingTransformBlob.text()
            const { body: existingTransformBody } = parseFrontmatter(existingTransformContent)

            const nextFrontmatter = serializeFrontmatter(frontmatterMetadata)
            const nextMarkdown = `---\n${nextFrontmatter}\n---\n\n${existingTransformBody}`

            const templateName = String(templateId || 'pdfanalyse')
            const writeRes = await writeArtifact(provider, {
              key: {
                sourceId: promotion.destinationBaseFileId,
                kind: 'transformation',
                targetLanguage: 'de',
                templateName,
              },
              sourceName: baseFileName,
              parentId: destinationFolderId,
              content: nextMarkdown,
              createFolder: true,
            })
            const updatedTransformFile = writeRes.file

            // 4) Ingestion (explizit, user-triggered)
            setWizardState(prev => ({
              ...prev,
              publishingProgress: 80,
              publishingMessage: 'Ingestion starten…',
            }))
            const ingestRes = await fetch(`/api/chat/${libId}/ingest-markdown`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: updatedTransformFile.id, fileName: updatedTransformFile.metadata?.name }),
            })
            if (!ingestRes.ok) {
              const errorText = await ingestRes.text().catch(() => 'Unknown error')
              throw new Error(`Ingestion fehlgeschlagen: ${errorText}`)
            }

            // 5) Logging + Session Finalisierung (Publish = Wizard-Abschluss)
            if (wizardSessionIdRef.current) {
              try {
                const filePaths = await getFilePaths(provider, {
                  savedItemId: updatedTransformFile.id,
                  transformFileId: updatedTransformFile.id,
                  baseFileId: promotion.destinationBaseFileId,
                })
                await logWizardEvent(wizardSessionIdRef.current, {
                  eventType: 'wizard_completed',
                  stepIndex: wizardState.currentStepIndex,
                  stepPreset: 'publish',
                  fileIds: {
                    savedItemId: updatedTransformFile.id,
                    transformFileId: updatedTransformFile.id,
                    baseFileId: promotion.destinationBaseFileId,
                  },
                  filePaths,
                })

                wizardSessionCompletedRef.current = true
                await finalizeWizardSessionClient(wizardSessionIdRef.current, 'completed', {
                  finalStepIndex: wizardState.currentStepIndex,
                  finalFileIds: {
                    savedItemId: updatedTransformFile.id,
                    transformFileId: updatedTransformFile.id,
                  },
                  finalFilePaths: {
                    savedPath: filePaths.savedPath,
                    transformPath: filePaths.transformPath,
                  },
                })
              } catch (error) {
                console.warn('[Wizard] Fehler beim Finalisieren der Session (Publish):', error)
              }
            }

            setWizardState(prev => ({
              ...prev,
              isPublishing: false,
              isPublished: true,
              publishingProgress: 100,
              publishingMessage: 'Fertig.',
              pdfTransformFileId: updatedTransformFile.id,
              pdfBaseFileId: promotion.destinationBaseFileId || prev.pdfBaseFileId,
            }))
            if (sessionIdForLogs) {
              const durationMs = Math.max(0, nowMs() - publishStartedAt)
              void logWizardEventClient(sessionIdForLogs, {
                eventType: 'publish_completed',
                stepIndex: wizardState.currentStepIndex,
                stepPreset: currentStep?.preset,
                metadata: { durationMs, mode: 'pdf_publish' },
              })
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
            setWizardState(prev => ({
              ...prev,
              isPublishing: false,
              publishError: msg,
              publishingProgress: prev.publishingProgress ?? 0,
              publishingMessage: msg,
            }))
            toast.error('Publizieren fehlgeschlagen', { description: msg })
            if (sessionIdForLogs) {
              const durationMs = Math.max(0, nowMs() - publishStartedAt)
              void logWizardEventClient(sessionIdForLogs, {
                eventType: 'publish_failed',
                stepIndex: wizardState.currentStepIndex,
                stepPreset: currentStep?.preset,
                metadata: { durationMs, mode: 'pdf_publish' },
                error: { code: 'publish_failed', message: msg },
              })
            }
          }
        }

        return (
          <PublishStep
            title={currentStep.title || "Publizieren"}
            description={currentStep.description || "Jetzt wird das Ergebnis final gespeichert und für die Suche indiziert."}
            onPublish={onPublish}
            isPublishing={!!wizardState.isPublishing}
            publishingProgress={typeof wizardState.publishingProgress === 'number' ? wizardState.publishingProgress : 0}
            publishingMessage={wizardState.publishingMessage}
            isPublished={!!wizardState.isPublished}
            onGoToLibrary={() => {
              // Primär: Gallery deep link via slug (Explorer-Modus)
              if (wizardState.publishTargetSlug && wizardState.publishTargetSlug.trim().length > 0) {
                router.push(`/library/gallery?doc=${encodeURIComponent(wizardState.publishTargetSlug)}`)
                return
              }
              // Fallback: File-Explorer folderId
              const folderParam =
                wizardState.publishTargetFolderId && wizardState.publishTargetFolderId.trim().length > 0
                  ? `?folderId=${encodeURIComponent(wizardState.publishTargetFolderId)}`
                  : ''
              router.push(`/library${folderParam}`)
            }}
            goToLibraryLabel="Im Explorer öffnen"
          >
            {wizardState.publishStats ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Dokumente: <span className="font-mono">{wizardState.publishStats.documents}</span></div>
                <div>Bilder: <span className="font-mono">{wizardState.publishStats.images}</span></div>
                <div>Quellen: <span className="font-mono">{wizardState.publishStats.sources}</span></div>
              </div>
            ) : null}
          </PublishStep>
        )
      }

      default:
        return (
          <div className="text-center text-muted-foreground p-8">
            Unbekannter Step-Preset: {currentStep.preset}
          </div>
        )
    }
  }

  const canProceed = () => {
    switch (currentStep.preset) {
      case "welcome":
        return true
      case "collectSource":
        // Während wir Metadaten laden/extrahieren, darf "Weiter" nicht klickbar sein.
        if (wizardState.isExtracting) return false
        // Weiter möglich, wenn:
        // 1) Quellen bereits vorhanden sind, ODER
        // 2) CollectSourceStep meldet "can proceed" (z.B. Text eingegeben oder PDF gewählt), ODER
        // 3) Legacy: collectedInput reicht
        if (wizardState.sources.length > 0) return true
        if (collectSourceCanProceed) return true
        return !!wizardState.collectedInput?.content
      case "reviewMarkdown":
        if (wizardState.isExtracting) return false
        if (!wizardState.draftText || wizardState.draftText.trim().length === 0) return false
        return !!wizardState.hasConfirmedMarkdown
      case "generateDraft":
        // Im Interview-Modus ist generateDraft zwingend
        // Im Form-Modus ist generateDraft optional (kann übersprungen werden)
        if (wizardState.mode === 'interview') {
          return !!wizardState.generatedDraft
        }
        return true // Im Form-Modus kann man auch ohne generateDraft weiter
      case "editDraft":
        return true // EditDraft ist immer editierbar, keine Validierung nötig
      case "uploadImages":
        return true // uploadImages ist immer optional (kann übersprungen werden)
      case "selectRelatedTestimonials":
        return true // selectRelatedTestimonials ist immer optional (kann übersprungen werden)
      case "previewDetail":
        return true
      case "publish":
        // "Weiter/Fertig" erst nach erfolgreichem Publish erlauben
        if (wizardState.isPublishing) return false
        return !!wizardState.isPublished
      default:
        return false
    }
  }

  return (
    <Card className="p-6">
      {/* Step-Indicator */}
      <div className="mb-6">
        {/* Struktur: Kreis ist immer mittig; Linien sind links/rechts als gleich lange Segmente. */}
        <div className="flex items-start justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1">
              <div className="flex flex-col items-center">
                {/* Kreis + Verbindungslinien (links/rechts) */}
                <div className="w-full flex items-center">
                  {/* Linkes Segment: Verbindung von vorherigem Step zu diesem */}
                  <div
                    className={`h-1 flex-1 ${
                      index === 0
                        ? "bg-transparent"
                        : index - 1 < wizardState.currentStepIndex
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />

                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${
                      index === wizardState.currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : index < wizardState.currentStepIndex
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Rechtes Segment: Verbindung von diesem Step zum nächsten */}
                  <div
                    className={`h-1 flex-1 ${
                      index === steps.length - 1
                        ? "bg-transparent"
                        : index < wizardState.currentStepIndex
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                </div>

                {/* Label: 2 Zeilen, aber mit genug Höhe, damit nichts abgeschnitten wird */}
                <div className="mt-2 text-xs text-center text-muted-foreground max-w-[120px] min-h-[2.75rem] leading-tight overflow-hidden">
                  {step.title || step.preset}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6 min-h-[400px]">
        {/* Überschrift/Beschreibung nur anzeigen, wenn der Step keine eigene Card hat */}
        {currentStep.preset !== 'collectSource' && currentStep.preset !== 'welcome' && currentStep.preset !== 'editDraft' && (
          <>
            {currentStep.title && (
              <h2 className="text-2xl font-semibold mb-2">{currentStep.title}</h2>
            )}
            {currentStep.description && (
              <p className="text-muted-foreground mb-6">{currentStep.description}</p>
            )}
          </>
        )}
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isFirstStep}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
        >
          {isLastStep
            ? (currentStep.preset === 'publish' ? "Fertig" : "Speichern")
            : "Weiter"}
          {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </Card>
  )
}




