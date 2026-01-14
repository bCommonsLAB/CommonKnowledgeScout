"use client"

import { useState, useEffect } from "react"
import { Upload, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TemplateMetadataSchema } from "@/lib/templates/template-types"
import type { WizardSource } from "@/lib/creation/corpus"
import { CompactSourcesInfo } from "@/components/creation-wizard/components/compact-sources-info"
import { DictationTextarea } from "@/components/shared/dictation-textarea"

interface EditDraftStepProps {
  templateMetadata: TemplateMetadataSchema
  draftMetadata: Record<string, unknown>
  draftText: string
  onMetadataChange: (metadata: Record<string, unknown>) => void
  onDraftTextChange: (text: string) => void
  /** Verwendete Quellen (für dezenten Hinweis unten) */
  sources?: WizardSource[]
  /**
   * Nur diese Felder anzeigen (benutzerrelevante Felder aus editDraft.fields).
   * Falls undefined, werden alle Felder angezeigt (Fallback für Legacy-Templates).
   */
  userRelevantFields?: string[]
  /**
   * Ob der Markdown-Tab angezeigt werden soll.
   * Standard: true, wenn draftText vorhanden ist.
   */
  showMarkdownTab?: boolean
  /**
   * Felder, die als Bild-Upload gerendert werden sollen (aus editDraft.imageFieldKeys).
   * Diese Felder müssen auch in userRelevantFields enthalten sein.
   */
  imageFieldKeys?: string[]
  /**
   * Library-ID für Bild-Upload
   */
  libraryId?: string
}

/**
 * EditDraftStep: Einfache, benutzerfreundliche Ansicht zum Bearbeiten.
 * 
 * - Kompakte Darstellung ohne technische Begriffe
 * - Inline-Bearbeitung mit Stift-Icon
 * - Klare, einfache Sprache
 * - Markdown-Editor als separater Tab
 */
export function EditDraftStep({
  templateMetadata,
  draftMetadata,
  draftText,
  onMetadataChange,
  onDraftTextChange,
  sources = [],
  userRelevantFields,
  showMarkdownTab = true,
  imageFieldKeys = [],
  libraryId,
}: EditDraftStepProps) {
  const [localMetadata, setLocalMetadata] = useState<Record<string, unknown>>(draftMetadata)
  const [localDraftText, setLocalDraftText] = useState(draftText)
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({})
  const [imageFiles, setImageFiles] = useState<Record<string, File | null>>({})

  const [creationTemplateOptions, setCreationTemplateOptions] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    let cancelled = false
    async function loadCreationTemplates() {
      if (!libraryId) return
      try {
        const res = await fetch(`/api/templates?libraryId=${encodeURIComponent(libraryId)}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as Record<string, unknown>))
        if (!res.ok) return
        const templates = Array.isArray((json as { templates?: unknown }).templates)
          ? ((json as { templates: unknown[] }).templates as unknown[])
          : []

        const options = templates
          .map((t) => (t && typeof t === 'object') ? (t as Record<string, unknown>) : null)
          .filter((t): t is Record<string, unknown> => !!t)
          .filter((t) => {
            const creation = t.creation
            return !!creation && typeof creation === 'object'
          })
          .map((t) => {
            const name = typeof t.name === 'string' ? t.name : ''
            const creation = (t.creation && typeof t.creation === 'object') ? (t.creation as Record<string, unknown>) : {}
            const ui = (creation.ui && typeof creation.ui === 'object') ? (creation.ui as Record<string, unknown>) : {}
            const displayName = typeof ui.displayName === 'string' ? ui.displayName : ''
            const label = displayName || name || 'Template'
            return { id: name, label }
          })
          .filter((o) => o.id.trim().length > 0)

        if (!cancelled) setCreationTemplateOptions(options)
      } catch {
        // ignore
      }
    }
    void loadCreationTemplates()
    return () => { cancelled = true }
  }, [libraryId])

  // Synchronisiere lokalen State mit Props
  useEffect(() => {
    setLocalMetadata(draftMetadata)
  }, [draftMetadata])

  useEffect(() => {
    setLocalDraftText(draftText)
  }, [draftText])

  /**
   * Konvertiert Feldnamen zu benutzerfreundlichen Labels.
   */
  function getFieldLabel(fieldKey: string): string {
    const field = templateMetadata.fields.find(f => f.key === fieldKey || f.variable === fieldKey)
    if (field?.description) {
      // Nutze den ersten Teil der Beschreibung als Label, falls vorhanden
      return field.description.split('.')[0] || fieldKey
    }
    
    // Fallback: Konvertiere camelCase zu lesbarem Text
    const labelMap: Record<string, string> = {
      title: "Titel",
      shortTitle: "Kurztitel",
      summary: "Zusammenfassung",
      teaser: "Teaser",
      date: "Datum",
      starttime: "Startzeit",
      endtime: "Endzeit",
      location: "Ort",
      tags: "Tags",
      speakers: "Sprecher",
      affiliations: "Organisationen",
      topics: "Themen",
    }
    return labelMap[fieldKey] || fieldKey
  }

  /**
   * Aktualisiert einen Metadaten-Wert direkt (automatisches Speichern)
   */
  function updateFieldValue(fieldKey: string, newValue: string) {
    const field = templateMetadata.fields.find(f => f.key === fieldKey || f.variable === fieldKey)
    const isArray = field && (field.rawValue?.includes("Array") || fieldKey === "tags" || fieldKey === "topics" || fieldKey === "affiliations")
    
    const processedValue = isArray
      ? newValue.split(",").map(t => t.trim()).filter(Boolean)
      : newValue
    
    const updated = { ...localMetadata, [fieldKey]: processedValue }
    setLocalMetadata(updated)
    onMetadataChange(updated)
  }

  const handleImageUpload = async (fieldKey: string, file: File) => {
    if (!libraryId) {
      toast.error("Library-ID fehlt")
      return
    }

    setUploadingImages(prev => ({ ...prev, [fieldKey]: true }))
    setImageFiles(prev => ({ ...prev, [fieldKey]: file }))

    try {
      const tempOwnerId = `temp_${Date.now()}`
      const scope = 'sessions' // Reuse sessions scope

      const formData = new FormData()
      formData.append('file', file)
      formData.append('key', fieldKey)
      formData.append('ownerId', tempOwnerId)
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
        const updated = { ...localMetadata, [fieldKey]: result.url }
        setLocalMetadata(updated)
        onMetadataChange(updated)
        toast.success(`Bild hochgeladen`)
      }
    } catch (error) {
      toast.error(`Fehler beim Hochladen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      setImageFiles(prev => ({ ...prev, [fieldKey]: null }))
    } finally {
      setUploadingImages(prev => ({ ...prev, [fieldKey]: false }))
    }
  }

  const handleImageRemove = (fieldKey: string) => {
    const updated = { ...localMetadata }
    delete updated[fieldKey]
    setLocalMetadata(updated)
    onMetadataChange(updated)
    setImageFiles(prev => ({ ...prev, [fieldKey]: null }))
  }


  function renderImageField(field: TemplateMetadataSchema['fields'][0]) {
    const imageUrl = localMetadata[field.key] as string | undefined
    const isUploading = uploadingImages[field.key] || false
    const localFile = imageFiles[field.key]
    const canCreateObjectUrl =
      typeof URL !== "undefined" && typeof (URL as unknown as { createObjectURL?: unknown }).createObjectURL === "function"
    const previewUrl = imageUrl || (localFile && canCreateObjectUrl ? URL.createObjectURL(localFile) : null)
    const label = getFieldLabel(field.key)

    return (
      <div
        key={field.key}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
            <div className="mt-2">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-500 rounded-lg p-6 text-center">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-500">Wird hochgeladen...</span>
                  </div>
                ) : previewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Preview nutzt (blob:) Object-URLs; next/image bringt hier keinen Vorteil. */}
                    <img
                      src={previewUrl}
                      alt={label}
                      className="max-w-full h-auto max-h-64 rounded-lg border border-slate-300 dark:border-slate-500 mx-auto"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => handleImageRemove(field.key)}
                      disabled={isUploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <label className="cursor-pointer">
                      <span className="text-sm text-slate-600 dark:text-slate-300 hover:underline">
                        Bild hochladen
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            void handleImageUpload(field.key, file)
                          }
                        }}
                        disabled={isUploading}
                      />
                    </label>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF, WEBP</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderField(field: TemplateMetadataSchema['fields'][0]) {
    const value = localMetadata[field.key]
    const label = getFieldLabel(field.key)
    const isArray = Array.isArray(value)
    const isLongText = typeof value === "string" && value.length > 120
    const displayValue = isArray ? (value as string[]).join(", ") : String(value || "")

    const isWizardPickerField =
      field.key === 'wizard_testimonial_template_id' ||
      field.key === 'wizard_finalize_template_id'

    if (isWizardPickerField) {
      const filter = (opt: { id: string; label: string }) => {
        const idLower = opt.id.toLowerCase()
        if (field.key === 'wizard_testimonial_template_id') return idLower.includes('testimonial')
        if (field.key === 'wizard_finalize_template_id') return idLower.includes('event-finalize') || idLower.includes('finalize')
        return true
      }
      const options = creationTemplateOptions.filter(filter)
      const current = typeof value === 'string' ? value : ''

      return (
        <div
          key={field.key}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
              <div className="mt-2">
                {libraryId && options.length > 0 ? (
                  <Select
                    value={current}
                    onValueChange={(v) => updateFieldValue(field.key, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Wizard auswählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label} <span className="text-xs text-muted-foreground">({opt.id})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => updateFieldValue(field.key, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-500 dark:bg-slate-600 dark:text-white"
                    placeholder="Template-ID (Name) eingeben…"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Für Text-Felder mit Diktat: Nutze generische DictationTextarea
    if (!isArray && !imageFieldKeys?.includes(field.key)) {
      const isLongText = field.key === "summary" || field.key.includes("experience") || field.key.includes("insight") || field.key.includes("important")
      return (
        <div
          key={field.key}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700"
        >
          <DictationTextarea
            label={label}
            value={displayValue}
            onChange={(next) => updateFieldValue(field.key, next)}
            placeholder="Hier eingeben..."
            rows={isLongText ? 4 : undefined}
            showOscilloscope={true}
            variant="inline"
            className="[&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-base dark:[&_textarea]:border-slate-500 dark:[&_textarea]:bg-slate-600 dark:[&_textarea]:text-white"
          />
        </div>
      )
    }

    // Für normale Input-Felder (ohne Diktat): Standard-Input/Textarea
    return (
      <div
        key={field.key}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
            <div className="mt-1">
              {isLongText || field.key === "summary" || field.key.includes("experience") || field.key.includes("insight") || field.key.includes("important") ? (
                <textarea
                  value={displayValue}
                  onChange={(e) => updateFieldValue(field.key, e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-500 dark:bg-slate-600 dark:text-white"
                  placeholder="Hier eingeben..."
                />
              ) : (
                <input
                  type="text"
                  value={displayValue}
                  onChange={(e) => updateFieldValue(field.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-500 dark:bg-slate-600 dark:text-white"
                  placeholder="Hier eingeben..."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
        {showMarkdownTab ? "Bearbeiten" : "Prüfen & Speichern"}
      </h1>
      <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
        {showMarkdownTab 
          ? "Du kannst alle Felder direkt bearbeiten. Änderungen werden automatisch gespeichert."
          : "Schau dir die Infos an. Du kannst alles direkt bearbeiten."}
      </p>

      {showMarkdownTab ? (
        <Tabs defaultValue="metadata" className="mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metadata">Felder</TabsTrigger>
            <TabsTrigger value="markdown">Text</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata" className="mt-6">
            <div className="space-y-4">
              {(() => {
                // Filtere Felder: Nur benutzerrelevante anzeigen (aus editDraft.fields)
                const fieldsToShow = userRelevantFields && userRelevantFields.length > 0
                  ? templateMetadata.fields.filter(f => userRelevantFields.includes(f.key))
                  : templateMetadata.fields // Fallback: Alle Felder, wenn keine Filterung definiert
                
                if (fieldsToShow.length === 0) {
                  return (
                    <div className="text-center text-muted-foreground py-8">
                      Keine Felder definiert.
                    </div>
                  )
                }
                
                return fieldsToShow.map(field => {
                  // Prüfe, ob dieses Feld ein Bildfeld ist
                  if (imageFieldKeys && imageFieldKeys.includes(field.key)) {
                    return renderImageField(field)
                  }
                  return renderField(field)
                })
              })()}
            </div>
          </TabsContent>

          <TabsContent value="markdown" className="mt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Text bearbeiten</label>
              <textarea
                value={localDraftText}
                onChange={(e) => {
                  setLocalDraftText(e.target.value)
                  onDraftTextChange(e.target.value)
                }}
                rows={20}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-500 dark:bg-slate-600 dark:text-white"
                placeholder="Text hier eingeben..."
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Änderungen werden automatisch gespeichert.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="mt-8 space-y-4">
          {(() => {
            // Filtere Felder: Nur benutzerrelevante anzeigen (aus reviewFields Steps)
            const fieldsToShow = userRelevantFields && userRelevantFields.length > 0
              ? templateMetadata.fields.filter(f => userRelevantFields.includes(f.key))
              : templateMetadata.fields // Fallback: Alle Felder, wenn keine Filterung definiert
            
            if (fieldsToShow.length === 0) {
              return (
                <div className="text-center text-muted-foreground py-8">
                  Keine Felder definiert.
                </div>
              )
            }
            
            return fieldsToShow.map(field => {
              // Prüfe, ob dieses Feld ein Bildfeld ist
              if (imageFieldKeys && imageFieldKeys.includes(field.key)) {
                return renderImageField(field)
              }
              return renderField(field)
            })
          })()}
        </div>
      )}

      {/* Dezent: Verwendete Quellen unten */}
      {sources.length > 0 && (
        <div className="mt-8">
          <CompactSourcesInfo sources={sources} />
        </div>
      )}
    </div>
  )
}



