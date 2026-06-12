"use client"

/**
 * useSecretaryServiceForm — Form-State + Submit fuer die
 * Transformations-Einstellungen (config.secretaryService).
 *
 * Extrahiert aus secretary-service-form.tsx (Welle 3-IV-UX-3a):
 * Zwei Render-Komponenten teilen sich den Hook —
 * secretary-service-form.tsx (Verarbeitung, redaktionell) und
 * secretary-advanced-form.tsx (Verbindung/PDF/LLM, "Erweitert").
 * react-hook-form haelt ALLE Felder im State (per reset geladen),
 * Submit sendet die vollstaendige secretaryService-Config — egal,
 * welche Teilmenge eine Seite rendert.
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useState, useEffect } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { toast } from "@/components/ui/use-toast"
import { mergeTemplateNames } from "@/lib/templates/template-options"
import {
  checkTemplateConsistency,
  type KnownTemplateMeta,
} from "@/lib/templates/template-consistency"

// Formular-Schema mit Validierung
export const secretaryServiceFormSchema = z.object({
  // Benutzerdefinierte Verbindung aktiv (false = ENV-Defaults)
  useCustomConfig: z.boolean().optional(),
  // Optional: Wenn gesetzt, muss es eine gültige URL sein
  apiUrl: z.string().url({ message: "Bitte geben Sie eine gültige URL ein." }).optional(),
  // Optional: Leer lassen → ENV verwenden
  apiKey: z.string().optional(),
  pdfExtractionMethod: z.enum([
    'native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'
  ]).optional(),
  pdfTemplate: z.string().optional(),
  /** Standard-LLM-Modell für Template-Transformation */
  templateLlmModel: z.string().optional(),
  /** Standard-Zielsprache für Transformation */
  targetLanguage: z.enum(['de', 'en']).optional(),
  /** Automatisch Cover-Bild bei Transformation generieren */
  generateCoverImage: z.boolean().optional(),
  coverImagePrompt: z.string().optional(),
  /** Desktop-Modus: Ergebnisse aktiv abholen statt per Webhook */
  useDirectConnection: z.boolean().optional(),
})

export type SecretaryServiceFormValues = z.infer<typeof secretaryServiceFormSchema>

export function useSecretaryServiceForm() {
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [availableTemplateNames, setAvailableTemplateNames] = useState<string[]>([])
  // F11: Vorlagen-Metadaten (detailViewType + Felder) fuer die Konsistenz-Pruefung
  const [templatesMeta, setTemplatesMeta] = useState<KnownTemplateMeta[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)

  // Inhaltstyp der Library — Bezugspunkt der Vorlagen-Konsistenz (F11)
  const libraryViewType =
    (activeLibrary?.config?.chat as { gallery?: { detailViewType?: string } } | undefined)
      ?.gallery?.detailViewType ?? 'book'

  const form = useForm<SecretaryServiceFormValues>({
    resolver: zodResolver(secretaryServiceFormSchema),
    defaultValues: {
      useCustomConfig: false,
      apiUrl: undefined,
      apiKey: '',
      pdfExtractionMethod: 'native',
      pdfTemplate: '',
      templateLlmModel: '',
      targetLanguage: 'de',
      generateCoverImage: false,
      coverImagePrompt: '',
      useDirectConnection: false,
    },
  })

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      // generateCoverImage: Lese aus secretaryService (chat-Fallback entfernt, da nicht im Typ)
      const generateCoverImage =
        typeof activeLibrary.config?.secretaryService?.generateCoverImage === 'boolean'
          ? activeLibrary.config.secretaryService.generateCoverImage
          : false

      // targetLanguage: Lese aus secretaryService oder chat (Rückwärtskompatibilität)
      const targetLanguage =
        activeLibrary.config?.secretaryService?.targetLanguage ||
        activeLibrary.config?.chat?.targetLanguage ||
        'de'

      form.reset({
        useCustomConfig: activeLibrary.config?.secretaryService?.useCustomConfig ?? false,
        apiUrl: activeLibrary.config?.secretaryService?.apiUrl || undefined,
        apiKey: activeLibrary.config?.secretaryService?.apiKey || '',
        pdfExtractionMethod: activeLibrary.config?.secretaryService?.pdfExtractionMethod || 'mistral_ocr',
        pdfTemplate: activeLibrary.config?.secretaryService?.template || '',
        templateLlmModel: activeLibrary.config?.secretaryService?.llmModel || '',
        targetLanguage: targetLanguage as 'de' | 'en',
        generateCoverImage,
        coverImagePrompt: activeLibrary.config?.secretaryService?.coverImagePrompt || '',
        useDirectConnection: activeLibrary.config?.secretaryService?.useDirectConnection ?? false,
      })
    }
  }, [activeLibrary, form])

  const currentPdfTemplate = form.watch('pdfTemplate')
  // useCustomConfig beobachten, um Verbindungsfelder bedingt anzuzeigen
  const isCustomConfig = form.watch('useCustomConfig') ?? false
  const currentApiUrl = form.watch('apiUrl')
  const hasCustomApiUrl = isCustomConfig && !!(currentApiUrl && currentApiUrl.trim())

  const mergedTemplateNames = mergeTemplateNames({
    templateNames: availableTemplateNames,
    currentTemplateName: currentPdfTemplate,
  })

  const hasMongoTemplates = mergedTemplateNames.length > 0
  const isCurrentTemplateInMongo = !!(currentPdfTemplate || '').trim() && mergedTemplateNames.some(
    (n) => n.toLowerCase() === (currentPdfTemplate || '').trim().toLowerCase()
  )
  const [templateMode, setTemplateMode] = useState<'select' | 'custom'>('select')

  // Wenn die Config einen Wert hat, der (noch) nicht in MongoDB existiert, zeige Custom-Input an.
  useEffect(() => {
    const val = (currentPdfTemplate || '').trim()
    if (!val) {
      setTemplateMode('select')
      return
    }
    setTemplateMode(isCurrentTemplateInMongo ? 'select' : 'custom')
  }, [currentPdfTemplate, isCurrentTemplateInMongo])

  // Templates aus MongoDB laden (für Dropdown)
  useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return
        setIsLoadingTemplates(true)
        const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibraryId)}`)
        if (!response.ok) {
          // Fehler still behandeln: Dropdown bleibt leer, Custom-Input bleibt nutzbar
          if (!cancelled) setAvailableTemplateNames([])
          return
        }
        const data = await response.json()
        const templates = Array.isArray((data as { templates?: unknown }).templates)
          ? (data as {
              templates: Array<{
                name?: unknown
                builtin?: unknown
                metadata?: { detailViewType?: unknown; fields?: Array<{ key?: unknown }> }
              }>
            }).templates
          : []
        const names = templates
          .map((t) => (typeof t?.name === 'string' ? t.name : ''))
          .filter((n) => n.length > 0)
        // F11: Metadaten fuer Konsistenz-Pruefung und Experten-Auswahl
        const meta: KnownTemplateMeta[] = templates
          .filter((t) => typeof t?.name === 'string' && (t.name as string).length > 0)
          .map((t) => ({
            name: t.name as string,
            detailViewType:
              typeof t.metadata?.detailViewType === 'string' ? t.metadata.detailViewType : undefined,
            fieldKeys: Array.isArray(t.metadata?.fields)
              ? t.metadata.fields
                  .map((f) => (typeof f?.key === 'string' ? f.key : ''))
                  .filter((k) => k.length > 0)
              : [],
            builtin: t.builtin === true,
          }))
        if (!cancelled) {
          setAvailableTemplateNames(names)
          setTemplatesMeta(meta)
        }
      } catch (err) {
        // H9-Fix: API-Fehler beim Laden der Template-Namen loggen
        if (!cancelled) {
          console.error('[SecretaryServiceForm] Template-Namen konnten nicht geladen werden:', err);
          setAvailableTemplateNames([])
        }
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => { cancelled = true }
  }, [activeLibraryId])

  async function onSubmit(data: SecretaryServiceFormValues) {
    // F11: Konsistenz Inhaltstyp ↔ Vorlage VOR dem Speichern pruefen —
    // das Datenmodell darf nicht inkonsistent persistiert werden.
    const consistency = checkTemplateConsistency({
      templateName: data.pdfTemplate,
      viewType: libraryViewType,
      knownTemplates: templatesMeta,
    })
    if (consistency.level === 'error') {
      toast({
        title: 'Vorlage passt nicht zum Inhaltstyp',
        description: consistency.message,
        variant: 'destructive',
      })
      return
    }
    if (consistency.level === 'warn') {
      toast({ title: 'Hinweis zur Vorlage', description: consistency.message })
    }

    setIsLoading(true)

    try {
      if (!activeLibrary) {
        throw new Error("Keine Bibliothek ausgewählt")
      }

      // Bibliotheksobjekt aktualisieren.
      // apiUrl/apiKey/useDirectConnection werden immer gespeichert (auch bei useCustomConfig=false),
      // damit beim Umschalten nichts verloren geht.
      const updatedLibrary = {
        ...activeLibrary,
        config: {
          ...activeLibrary.config,
          secretaryService: {
            useCustomConfig: data.useCustomConfig ?? false,
            ...(data.apiUrl ? { apiUrl: data.apiUrl } : {}),
            ...(data.apiKey ? { apiKey: data.apiKey } : {}),
            // Phase 1: Transkription
            pdfExtractionMethod: data.pdfExtractionMethod,
            // Phase 2: Transformation
            template: data.pdfTemplate?.trim() || undefined,
            llmModel: data.templateLlmModel?.trim() || undefined,
            targetLanguage: data.targetLanguage || 'de',
            generateCoverImage: data.generateCoverImage ?? false,
            ...(data.coverImagePrompt?.trim() ? { coverImagePrompt: data.coverImagePrompt.trim() } : {}),
            useDirectConnection: data.useDirectConnection ?? false,
          },
        }
      }

      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedLibrary),
      })

      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`)
      }

      // Lokalen Zustand aktualisieren
      const updatedLibraries: typeof libraries = libraries.map(lib => {
        if (lib.id !== activeLibrary.id) return lib
        return {
          ...lib,
          config: {
            ...lib.config,
            secretaryService: {
              useCustomConfig: data.useCustomConfig ?? false,
              apiUrl: data.apiUrl || lib.config?.secretaryService?.apiUrl || '',
              apiKey: data.apiKey || lib.config?.secretaryService?.apiKey || '',
              // Phase 1: Transkription
              pdfExtractionMethod: data.pdfExtractionMethod,
              // Phase 2: Transformation
              template: data.pdfTemplate?.trim() || undefined,
              llmModel: data.templateLlmModel?.trim() || undefined,
              targetLanguage: data.targetLanguage || 'de',
              generateCoverImage: data.generateCoverImage ?? false,
              ...(data.coverImagePrompt?.trim() ? { coverImagePrompt: data.coverImagePrompt.trim() } : {}),
              useDirectConnection: data.useDirectConnection ?? false,
            },
          }
        }
      })

      setLibraries(updatedLibraries)

      toast({
        title: "Transformations-Einstellungen aktualisiert",
        description: `Die Transformations-Einstellungen für "${activeLibrary.label}" wurden erfolgreich aktualisiert.`,
      })

    } catch (error) {
      console.error('Fehler beim Speichern der Transformations-Einstellungen:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    form,
    activeLibrary,
    isLoading,
    isLoadingTemplates,
    templateMode,
    setTemplateMode,
    mergedTemplateNames,
    hasMongoTemplates,
    templatesMeta,
    libraryViewType,
    isCustomConfig,
    hasCustomApiUrl,
    onSubmit,
  }
}
