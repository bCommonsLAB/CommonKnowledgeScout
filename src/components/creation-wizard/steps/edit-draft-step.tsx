"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Upload, Loader2, X, Mic } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import type { TemplateMetadataSchema } from "@/lib/templates/template-types"
import type { WizardSource } from "@/lib/creation/corpus"
import { CompactSourcesInfo } from "@/components/creation-wizard/components/compact-sources-info"
import { AudioOscilloscope } from "@/components/creation-wizard/components/audio-oscilloscope"
import { toast } from "sonner"

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
  
  // Audio-Aufnahme State (pro Feld)
  const [recordingField, setRecordingField] = useState<string | null>(null)
  const [transcribingField, setTranscribingField] = useState<string | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const canUseMediaRecorder = useMemo(() => {
    return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator?.mediaDevices?.getUserMedia
  }, [])

  useEffect(() => {
    if (!recordingField) return
    const intervalId = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [recordingField])

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

  async function transcribeAudioForField(fieldKey: string, file: File): Promise<void> {
    setTranscribingField(fieldKey)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("source_language", "de")
      formData.append("target_language", "de")

      const res = await fetch("/api/secretary/process-audio", {
        method: "POST",
        body: formData,
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const errMsg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : `HTTP ${res.status}`
        throw new Error(errMsg)
      }

      // Extrahiere Transkription aus Response
      const transcriptionText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { transcription?: { text?: unknown } } }).data?.transcription?.text
          : undefined

      const outputText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { output_text?: unknown } }).data?.output_text
          : undefined

      const originalText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { original_text?: unknown } }).data?.original_text
          : undefined

      const text =
        typeof transcriptionText === "string"
          ? transcriptionText
          : typeof outputText === "string"
            ? outputText
            : typeof originalText === "string"
              ? originalText
              : ""

      if (!text.trim()) {
        throw new Error("Keine Transkription erhalten.")
      }

      // Füge den transkribierten Text zum Feld hinzu (append, nicht ersetzen)
      const currentValue = localMetadata[fieldKey]
      const existingText = typeof currentValue === "string" ? currentValue.trim() : ""
      const newText = text.trim()
      
      const updatedValue = existingText && newText
        ? `${existingText}\n\n${newText}`
        : newText || existingText

      const updated = { ...localMetadata, [fieldKey]: updatedValue }
      setLocalMetadata(updated)
      onMetadataChange(updated)
      
      toast.success("Audio wurde transkribiert")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler"
      toast.error("Audio konnte nicht verarbeitet werden", { description: msg })
    } finally {
      setTranscribingField(null)
    }
  }

  async function startRecordingForField(fieldKey: string): Promise<void> {
    if (!canUseMediaRecorder) {
      toast.error("Dein Browser unterstützt keine Audio-Aufnahme.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setLiveStream(stream)

      const preferredMime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : ""

      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      setRecordingSeconds(0)
      setRecordingField(fieldKey)

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          const file = new File([blob], "dictation.webm", { type: blob.type })
          await transcribeAudioForField(fieldKey, file)
        } finally {
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          setLiveStream(null)
          mediaRecorderRef.current = null
          audioChunksRef.current = []
          setRecordingField(null)
          setRecordingSeconds(0)
        }
      }

      recorder.start()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mikrofon-Zugriff fehlgeschlagen."
      toast.error(msg)
      setRecordingField(null)
    }
  }

  function stopRecordingForField(): void {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state !== "inactive") recorder.stop()
    setRecordingField(null)
  }

  function renderImageField(field: TemplateMetadataSchema['fields'][0]) {
    const imageUrl = localMetadata[field.key] as string | undefined
    const isUploading = uploadingImages[field.key] || false
    const localFile = imageFiles[field.key]
    const previewUrl = imageUrl || (localFile ? URL.createObjectURL(localFile) : null)
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
          <div className="shrink-0 flex items-center gap-1">
            {/* Mikrofon-Button (nur für Text-Felder, nicht für Arrays oder Bildfelder) */}
            {canUseMediaRecorder && !isArray && !imageFieldKeys?.includes(field.key) && (
              <button
                onClick={() => {
                  if (recordingField === field.key) {
                    stopRecordingForField()
                  } else {
                    // Stoppe andere Aufnahmen, falls aktiv
                    if (recordingField) {
                      stopRecordingForField()
                    }
                    void startRecordingForField(field.key)
                  }
                }}
                disabled={transcribingField === field.key || (recordingField !== null && recordingField !== field.key)}
                className={`rounded-lg p-2 transition-colors ${
                  recordingField === field.key
                    ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                    : "text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-white"
                }`}
                aria-label={`${label} diktieren`}
                title={recordingField === field.key ? "Aufnahme stoppen" : "Diktieren"}
              >
                {transcribingField === field.key ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : recordingField === field.key ? (
                  <div className="relative">
                    <Mic className="h-5 w-5" />
                    {liveStream && (
                      <div className="absolute inset-0 rounded-lg overflow-hidden opacity-20 pointer-events-none">
                        <AudioOscilloscope stream={liveStream} isActive={true} />
                      </div>
                    )}
                  </div>
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>
        {/* Aufnahme-Zeit-Anzeige */}
        {recordingField === field.key && recordingSeconds > 0 && (
          <div className="mt-2 text-xs text-slate-500 text-center">
            Aufnahme läuft: {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
          </div>
        )}
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



