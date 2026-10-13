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
import { useState, useEffect } from "react"
import { useActiveLibraryId, useLibraries, useSetLibraries } from '@ks/shell/react'
import { toast } from '@ks/ui'
import { mergeTemplateNames } from "@/lib/templates/template-options"
import {
  buildSecretaryServiceConfig,
  readSecretaryServiceForm,
  secretaryServiceFormSchema,
  type SecretaryServiceFormValues,
} from "./secretary-service-form-model"
import {
  checkTemplateConsistency,
  type KnownTemplateMeta,
} from "@/lib/templates/template-consistency"

// Schema, Lesen und Schreiben liegen im reinen Modell (testbar ohne React);
// das Schema und der Werte-Typ bleiben hier re-exportiert.
export { secretaryServiceFormSchema, type SecretaryServiceFormValues }

export function useSecretaryServiceForm() {
  const libraries = useLibraries()
  const setLibraries = useSetLibraries()
  const activeLibraryId = useActiveLibraryId()
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

  // Form mit aktiver Bibliothek befüllen — ALLE Felder, egal welche Teilmenge
  // die Seite rendert (geteiltes Objekt, siehe secretary-service-form-model.ts)
  useEffect(() => {
    if (activeLibrary) {
      form.reset(readSecretaryServiceForm(activeLibrary.config))
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

      // Bibliotheksobjekt aktualisieren: secretaryService VOLLSTAENDIG
      // (gespeicherte Felder der anderen Seite inklusive, da im Formular geladen).
      const updatedLibrary = {
        ...activeLibrary,
        config: {
          ...activeLibrary.config,
          secretaryService: buildSecretaryServiceConfig(data),
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
