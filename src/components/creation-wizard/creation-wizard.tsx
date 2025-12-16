"use client"

import { useState, useEffect } from "react"
import { loadTemplateConfig } from "@/lib/templates/template-service-client"
import type { TemplateDocument, CreationSource, CreationSourceType } from "@/lib/templates/template-types"
import { ChooseSourceStep } from "./steps/choose-source-step"
import { CollectSourceStep } from "./steps/collect-source-step"
import { GenerateDraftStep } from "./steps/generate-draft-step"
import { BriefingStep } from "./steps/briefing-step"
import { EditDraftStep } from "./steps/edit-draft-step"
import { WelcomeStep } from "./steps/welcome-step"
import { PreviewDetailStep } from "./steps/preview-detail-step"
import { UploadImagesStep } from "./steps/upload-images-step"
import { SelectRelatedTestimonialsStep } from "./steps/select-related-testimonials-step"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useStorage } from "@/contexts/storage-context"
import { useRouter } from "next/navigation"
import { useAtomValue } from "jotai"
import { currentFolderIdAtom } from "@/atoms/library-atom"
import { buildCreationFileName } from "@/lib/creation/file-name"
import type { WizardSource } from "@/lib/creation/corpus"
import { buildCorpusText, isCorpusTooLarge, truncateCorpus } from "@/lib/creation/corpus"
import { parseFrontmatter } from "@/lib/markdown/frontmatter"
import { findRelatedTestimonials } from "@/lib/creation/dialograum-discovery"

declare global {
  interface Window {
    /**
     * Temporäre Brücke: `CollectSourceStep` legt hier eine Funktion ab,
     * damit der Wizard beim Klick auf „Weiter“ den aktuellen Input als Quelle übernehmen kann.
     */
    __collectSourceStepBeforeLeave?: () => WizardSource | null
  }
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
}

export function CreationWizard({ typeId, templateId, libraryId, resumeFileId, seedFileId }: CreationWizardProps) {
  const [template, setTemplate] = useState<TemplateDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStepIndex: 0,
    sources: [],
  })
  
  // Speichere resumeFileId und seedFileId im State für späteren Zugriff beim Speichern
  const [resumeFileIdState] = useState<string | undefined>(resumeFileId)
  const [seedFileIdState, setSeedFileIdState] = useState<string | undefined>(seedFileId)
  const { provider, refreshItems } = useStorage()
  const currentFolderId = useAtomValue(currentFolderIdAtom)
  const router = useRouter()

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
        
        // Erstelle WizardSource für Dialograum
        const dialograumSource: WizardSource = {
          id: `file-${seedFileId}`,
          kind: 'file',
          fileName: dialograumItem.metadata.name || 'unbekannt',
          extractedText: body.trim(),
          summary: body.length > 200 ? `${body.slice(0, 200)}...` : body,
          createdAt: new Date(),
        }
        
        // Finde zugehörige Testimonials
        const testimonials = await findRelatedTestimonials({
          provider,
          startFileId: seedFileId,
          libraryId,
        })
        
        // Konvertiere Testimonials zu WizardSources
        const testimonialSources: WizardSource[] = []
        for (const testimonial of testimonials) {
          try {
            const { blob: testimonialBlob } = await provider.getBinary(testimonial.fileId)
            const testimonialContent = await testimonialBlob.text()
            const { body: testimonialBody } = parseFrontmatter(testimonialContent)
            
            testimonialSources.push({
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
        
        // Kombiniere Sources: Dialograum zuerst, dann Testimonials
        const allSources = [dialograumSource, ...testimonialSources]
        
        // Finde ersten selectRelatedTestimonials Step (oder nächsten Step nach collectSource)
        const steps = template.creation?.flow.steps || []
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
        
        toast.success(`Dialograum geladen, ${testimonials.length} Testimonial(s) gefunden`)
      } catch (error) {
        toast.error(`Fehler beim Laden der Seed-Datei: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      }
    }

    void loadSeedFile()
  }, [seedFileId, provider, template, libraryId])

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
        throw new Error(errorData.error || `HTTP ${response.status}`)
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
      }))

      toast.success("Quellen wurden ausgewertet")
    } catch (error) {
      toast.error(`Fehler beim Auswerten: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      setWizardState(prev => ({ ...prev, isExtracting: false }))
    }
  }

  /**
   * Fügt eine neue Quelle hinzu und triggert Re-Extract.
   * Wenn bereits eine Text-Quelle existiert, wird diese aktualisiert statt eine neue zu erstellen.
   */
  const addSource = async (source: WizardSource) => {
    // Wenn es eine Text-Quelle ist und bereits eine Text-Quelle existiert, aktualisiere diese
    if (source.kind === 'text') {
      const existingTextSourceIndex = wizardState.sources.findIndex(s => s.kind === 'text')
      if (existingTextSourceIndex >= 0) {
        // Aktualisiere die bestehende Text-Quelle
        const updatedSources = [...wizardState.sources]
        updatedSources[existingTextSourceIndex] = {
          ...source,
          id: updatedSources[existingTextSourceIndex].id, // Behalte die bestehende ID
          createdAt: updatedSources[existingTextSourceIndex].createdAt, // Behalte das ursprüngliche Datum
        }
        setWizardState(prev => ({ ...prev, sources: updatedSources }))
        await runExtraction(updatedSources)
        return
      }
    }
    
    // Ansonsten: Neue Quelle hinzufügen
    const newSources = [...wizardState.sources, source]
    setWizardState(prev => ({ ...prev, sources: newSources }))
    await runExtraction(newSources)
  }

  /**
   * Entfernt eine Quelle und triggert Re-Extract.
   */
  const removeSource = async (sourceId: string) => {
    const newSources = wizardState.sources.filter(s => s.id !== sourceId)
    setWizardState(prev => ({ ...prev, sources: newSources }))
    await runExtraction(newSources)
  }

  const handleNext = async () => {
    if (isLastStep) {
      handleSave()
      return
    }

    // Beim Verlassen von collectSource: Füge noch nicht hinzugefügte Quelle hinzu
    if (currentStep.preset === 'collectSource') {
      const createSource = window.__collectSourceStepBeforeLeave
      if (createSource && typeof createSource === 'function') {
        const newSource = createSource()
        if (newSource) {
          await addSource(newSource)
        }
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
      // Auch wenn wir Quellen haben, wurde bereits automatisch extrahiert.
      if (nextStep?.preset === 'generateDraft' && (prev.generatedDraft || prev.sources.length > 0)) {
        return { ...prev, currentStepIndex: Math.min(nextRawIndex + 1, steps.length - 1) }
      }

      return { ...prev, currentStepIndex: nextRawIndex }
    })
  }

  const handleBack = () => {
    if (isFirstStep) return
    setWizardState(prev => ({
      ...prev,
      currentStepIndex: prev.currentStepIndex - 1,
    }))
  }

  const handleSave = async () => {
    if (!provider) {
      toast.error("Kein Storage Provider verfügbar")
      return
    }
    if (!template?.creation) {
      toast.error("Template ist nicht geladen")
      return
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

      const { fileName, updatedMetadata: finalMetadata } = buildCreationFileName({
        typeId,
        metadata: baseMetadata,
        config: template.creation.output?.fileName,
      })

      // Bestimme OwnerId (Dateiname ohne .md)
      const ownerId = fileName.replace(/\.md$/, '')

      // Bestimme Scope aus preview.detailViewType
      const detailViewType = template.creation.preview?.detailViewType || 'session'
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
      
      // Auto-generiere dialograum_id wenn Feld vorhanden aber leer ist
      if (frontmatterKeys.has('dialograum_id') && (!frontmatterMetadata.dialograum_id || String(frontmatterMetadata.dialograum_id).trim() === '')) {
        // Generiere UUID-ähnliche ID (ohne Bindestriche für URL-Sicherheit)
        const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        frontmatterMetadata.dialograum_id = uuid
      }

      // Body: bevorzugt explizites Markdown (vom LLM oder manuell), sonst aus Template-Body rendern
      // Verwende metadataWithImages, damit Bild-URLs im Body verfügbar sind
      let finalBodyMarkdown = preferredMarkdown.trim().length > 0
        ? preferredMarkdown
        : renderTemplateBody({ body: template.markdownBody || "", values: metadataWithImages })

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
      creationFlowMetadata.creationDetailViewType = template.creation.preview?.detailViewType || 'session'
      
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
          await provider.uploadFile(targetFolderId, file)
          
          toast.success("Datei erfolgreich aktualisiert!")
        } catch (error) {
          toast.error(`Fehler beim Aktualisieren: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
          throw error
        }
      } else {
        // Normal-Modus: Neue Datei erstellen
        targetFolderId = currentFolderId && currentFolderId.trim().length > 0 ? currentFolderId : "root"
        targetFileName = fileName
        const file = new File([markdownContent], targetFileName, { type: "text/markdown" })
        await provider.uploadFile(targetFolderId, file)
        
        toast.success("Content erfolgreich erstellt!")
      }
      
      // Wichtig: refreshItems erwartet eine folderId. Ohne Parameter entsteht fileId=undefined im Request.
      await refreshItems(targetFolderId)
      router.push("/library")
    } catch (error) {
      toast.error(`Fehler beim Speichern: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
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

      case "briefing":
        return (
          <BriefingStep
            template={template}
            steps={steps}
            selectedMode={wizardState.mode}
            onModeSelect={(mode) => {
              // Wenn Formular gewählt wird, ist keine Quelle nötig.
              // Wir räumen die Source-Auswahl weg, damit nichts doppelt wirkt.
              setWizardState(prev => ({
                ...prev,
                mode,
                selectedSource: mode === 'form' ? undefined : prev.selectedSource,
                collectedInput: mode === 'form' ? undefined : prev.collectedInput,
              }))
            }}
            supportedSources={creation.supportedSources}
            selectedSource={wizardState.selectedSource}
            onSourceSelect={(source) => {
              setWizardState(prev => ({ ...prev, selectedSource: source }))
            }}
          />
        )

      case "chooseSource":
        // Wenn nur eine Quelle vorhanden ist und bereits ausgewählt, zeige eine Meldung
        // (der Step wird beim handleNext automatisch übersprungen)
        if (creation.supportedSources.length === 1 && wizardState.selectedSource) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Quelle wird automatisch ausgewählt...
            </div>
          )
        }
        return (
          <ChooseSourceStep
            supportedSources={creation.supportedSources}
            onSelect={(source) => {
              setWizardState(prev => ({ ...prev, selectedSource: source }))
            }}
            selectedSource={wizardState.selectedSource}
          />
        )

      case "collectSource":
        if (!wizardState.selectedSource) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Bitte zuerst eine Quelle auswählen.
            </div>
          )
        }
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
            templateId={templateId}
            libraryId={libraryId}
          />
        )

      case "generateDraft":
        // Im Interview-Modus ist generateDraft zwingend nach collectSource
        // Im Form-Modus kann generateDraft optional sein
        if (wizardState.mode === 'interview' && !wizardState.collectedInput) {
          return (
            <div className="text-center text-muted-foreground p-8">
              Bitte zuerst Eingaben sammeln.
            </div>
          )
        }
        // Im Form-Modus kann generateDraft auch ohne collectedInput aufgerufen werden (z.B. zur Initialbefüllung)
        const inputForGeneration = wizardState.collectedInput?.content || ""
        return (
          <GenerateDraftStep
            templateId={templateId}
            libraryId={libraryId}
            input={inputForGeneration}
            onGenerate={(draft) => {
              setWizardState(prev => ({
                ...prev,
                generatedDraft: draft,
                // Im Form-Modus: Initialisiere draftMetadata und draftText aus generatedDraft
                draftMetadata: prev.mode === 'form' ? draft.metadata : prev.draftMetadata,
                draftText: prev.mode === 'form' ? draft.markdown : prev.draftText,
              }))
            }}
            generatedDraft={wizardState.generatedDraft}
          />
        )

      case "editDraft": {
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
            onSelectionChange={(selectedSources) => {
              // Aktualisiere Sources: Dialograum bleibt, Testimonials werden gefiltert
              const dialograumSource = wizardState.sources.find(s => 
                s.kind === 'file' && 
                s.fileName && 
                s.fileName.toLowerCase().includes('dialograum')
              )
              const updatedSources = dialograumSource 
                ? [dialograumSource, ...selectedSources]
                : selectedSources
              
              setWizardState(prev => ({
                ...prev,
                sources: updatedSources,
              }))
            }}
          />
        )
      }

      case "previewDetail": {
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

        const detailViewType = creation.preview?.detailViewType || "session"

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
            metadata={metadataWithImages}
            markdown={previewMarkdown}
            libraryId={libraryId}
          />
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
      case "briefing":
        // Step 1 ist bewusst einfach:
        // - Formular: nur Mode reicht
        // - Alles andere: Quelle muss gewählt sein (Interview/Webseite/Text/Datei)
        if (wizardState.mode === 'form') return true
        return !!wizardState.selectedSource
      case "chooseSource":
        return !!wizardState.selectedSource
      case "collectSource":
        // Weiter möglich, wenn:
        // 1. Quellen bereits vorhanden sind, ODER
        // 2. Text im Input-Feld vorhanden ist (wird beim Next-Click automatisch hinzugefügt)
        const hasTextInput = typeof window !== 'undefined' && window.__collectSourceStepBeforeLeave
          ? window.__collectSourceStepBeforeLeave() !== null
          : false
        
        if (wizardState.sources.length > 0 || hasTextInput) {
          return true
        }
        return !!wizardState.collectedInput?.content // Legacy: collectedInput reicht
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
          {isLastStep ? "Speichern" : "Weiter"}
          {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </Card>
  )
}




