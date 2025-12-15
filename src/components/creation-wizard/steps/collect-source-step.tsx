"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { CreationSource } from "@/lib/templates/template-types"
import { Mic, Link, Upload, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AudioOscilloscope } from "@/components/creation-wizard/components/audio-oscilloscope"
import { SecretaryServiceError } from "@/lib/secretary/client"
import type { WizardSource } from "@/lib/creation/corpus"
import type { TemplateMetadataSchema } from "@/lib/templates/template-types"

interface CollectSourceStepProps {
  source: CreationSource
  mode?: 'interview' | 'form'
  // Legacy: onCollect (wird schrittweise durch onAddSource ersetzt)
  onCollect?: (content: string) => void
  onCollectStructured?: (result: { metadata: Record<string, unknown>; markdown?: string }) => void
  collectedInput?: string
  // Multi-Source: Neue Props
  sources?: WizardSource[]
  onAddSource?: (source: WizardSource) => void
  onRemoveSource?: (sourceId: string) => void
  isExtracting?: boolean
  templateId?: string
  libraryId?: string
  // Spickzettel: Benötigte Felder anzeigen
  templateMetadata?: TemplateMetadataSchema
  requiredFields?: string[]
  // Callback: Wird aufgerufen, wenn der Step verlassen wird, um noch nicht hinzugefügte Quellen zu erfassen
  onBeforeLeave?: () => WizardSource | null
}

export function CollectSourceStep({
  source,
  onCollect,
  onCollectStructured,
  collectedInput,
  sources = [],
  onAddSource,
  isExtracting = false,
  templateId,
  libraryId,
  // Unbenutzte Props werden hier ignoriert, bleiben aber im Interface für zukünftige Verwendung
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode: _unused_mode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRemoveSource: _unused_onRemoveSource,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  templateMetadata: _unused_templateMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requiredFields: _unused_requiredFields,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBeforeLeave: _unused_onBeforeLeave,
}: CollectSourceStepProps) {
  // Initialisiere Input-State: Verwende bestehende Text-Quelle, falls vorhanden
  const existingTextSource = sources.find(s => s.kind === 'text')
  const initialInput = collectedInput || existingTextSource?.text || ""
  const [input, setInput] = useState(initialInput)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExtractingUrl, setIsExtractingUrl] = useState(false)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)
  
  // Synchronisiere Input-State mit bestehender Text-Quelle, wenn sich sources ändern
  useEffect(() => {
    const textSource = sources.find(s => s.kind === 'text')
    if (textSource && textSource.text && textSource.text !== input) {
      setInput(textSource.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]) // input absichtlich nicht in Dependencies, um Endlosschleife zu vermeiden
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const canUseMediaRecorder = useMemo(() => {
    return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator?.mediaDevices?.getUserMedia
  }, [])

  useEffect(() => {
    if (!isRecording) return
    const intervalId = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [isRecording])

  const handleSubmit = () => {
    if (input.trim()) {
      if (onCollect) {
        // Legacy: Fallback auf altes System
        onCollect(input.trim())
      }
    }
  }

  // handleAddTextSource wurde entfernt, da nicht verwendet
  // Text-Quellen werden jetzt über createSourceFromInput beim Verlassen des Steps hinzugefügt

  function isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString)
      return true
    } catch {
      return false
    }
  }

  async function handleExtractFromWebsite(): Promise<void> {
    setErrorMessage(null)
    const url = input.trim()
    if (!url) return
    if (!isValidUrl(url)) {
      setErrorMessage("Bitte gib einen gültigen Link ein.")
      return
    }
    if (!templateId || !libraryId) {
      setErrorMessage("Template-Konfiguration fehlt (templateId/libraryId).")
      return
    }

    setIsExtractingUrl(true)
    try {
      // UX: One-click. URL rein → Felder raus (Template wird serverseitig aus MongoDB geladen).
      const response = await fetch("/api/secretary/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          source_language: "de",
          target_language: "de",
          use_cache: false,
          templateId,
          libraryId,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const msg =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: { message?: unknown } }).error?.message ?? "Unbekannter Fehler")
            : `HTTP ${response.status}`
        throw new SecretaryServiceError(msg)
      }

      // Erwartetes Format: { status:'success', data: { structured_data, markdown? } }
      const dataObj =
        payload && typeof payload === "object" && "data" in payload
          ? (payload as { data?: unknown }).data
          : null

      const structured =
        dataObj && typeof dataObj === "object" && "structured_data" in dataObj
          ? (dataObj as { structured_data?: unknown }).structured_data
          : undefined

      const markdown =
        dataObj && typeof dataObj === "object"
          ? (dataObj as { markdown?: unknown; markdown_content?: unknown; markdownContent?: unknown }).markdown
          : undefined
      const markdownContent =
        dataObj && typeof dataObj === "object"
          ? (dataObj as { markdown_content?: unknown; markdownContent?: unknown }).markdown_content ?? (dataObj as { markdownContent?: unknown }).markdownContent
          : undefined

      if (!structured || typeof structured !== "object") {
        throw new SecretaryServiceError("Keine Felder gefunden. Bitte prüfe den Link oder das Template.")
      }

      // Multi-Source: Speichere URL-Quelle mit rawWebsiteText + Summary
      if (onAddSource) {
        // Extrahiere rawWebsiteText aus Response (prioritär data.text, sonst Fallback auf markdown)
        // WICHTIG: rawWebsiteText ist der Point-of-Truth für LLM-Verarbeitung
        const rawText = 
          (dataObj && typeof dataObj === "object" && "text" in dataObj && typeof dataObj.text === "string" && dataObj.text.trim())
            ? dataObj.text.trim()
            : (typeof markdown === "string" && markdown.trim() 
                ? markdown.trim() 
                : (typeof markdownContent === "string" && markdownContent.trim() 
                    ? markdownContent.trim() 
                    : ""))
        
        // Baue Summary aus structured_data (Key-Value-Format) für UI-Anzeige
        const summaryLines: string[] = []
        if (structured && typeof structured === "object") {
          for (const [key, value] of Object.entries(structured)) {
            if (value !== null && value !== undefined) {
              const valueStr = Array.isArray(value) 
                ? JSON.stringify(value)
                : String(value)
              // Kürze sehr lange Werte für bessere Lesbarkeit
              const displayValue = valueStr.length > 100 ? `${valueStr.slice(0, 100)}...` : valueStr
              summaryLines.push(`${key}: ${displayValue}`)
            }
          }
        }
        const summary = summaryLines.length > 0 
          ? summaryLines.join('\n')
          : (typeof markdown === "string" && markdown.trim() 
              ? markdown.slice(0, 200) + (markdown.length > 200 ? '...' : '') 
              : url)

        const urlSource: WizardSource = {
          id: `url-${Date.now()}`,
          kind: 'url',
          url,
          rawWebsiteText: rawText || summary, // Fallback: Summary als raw, wenn kein text vorhanden
          summary,
          createdAt: new Date(),
        }
        
        onAddSource(urlSource)
        setInput("") // Leere Eingabe nach Hinzufügen
        toast.success("Webseite wurde hinzugefügt")
      } else {
        // Legacy: Fallback auf altes System
        onCollect?.(url)
        onCollectStructured?.({
          metadata: structured as Record<string, unknown>,
          markdown: typeof markdown === "string" ? markdown : typeof markdownContent === "string" ? markdownContent : undefined,
        })
        toast.success("Webseite wurde ausgewertet")
      }
    } catch (e) {
      const msg =
        e instanceof SecretaryServiceError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Unbekannter Fehler"
      setErrorMessage(msg)
      toast.error("Webseite konnte nicht ausgelesen werden", { description: msg })
    } finally {
      setIsExtractingUrl(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setInput(text)
      onCollect?.(text)
    } catch (error) {
      console.error("Fehler beim Lesen der Datei:", error)
    }
  }

  async function transcribeAudio(file: File): Promise<void> {
    setErrorMessage(null)
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      // Wir transkribieren erst mal nur. Die Interpretation (Felder füllen) passiert in generateDraft.
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

      // NOTE: Secretary AudioProcessor liefert die Transkription unter data.transcription.text
      // (und optional weitere Felder wie transformation_result).
      const transcriptionText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { transcription?: { text?: unknown } } }).data?.transcription?.text
          : undefined

      // Fallbacks (ältere/alternative Response-Formate)
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

      // Füge den neuen Text zum bestehenden Text hinzu (nicht ersetzen)
      setInput((prev) => {
        const existingText = prev.trim()
        const newText = text.trim()
        if (existingText && newText) {
          return `${existingText}\n\n${newText}`
        }
        return newText || existingText
      })
      // Legacy: Fallback auf altes System
      if (onCollect) {
        onCollect(text)
      }
      toast.success("Audio wurde transkribiert")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler"
      setErrorMessage(msg)
      toast.error("Audio konnte nicht verarbeitet werden", { description: msg })
    } finally {
      setIsTranscribing(false)
    }
  }

  async function startRecording(): Promise<void> {
    setErrorMessage(null)
    if (!canUseMediaRecorder) {
      setHasMicPermission(false)
      setErrorMessage("Dein Browser unterstützt keine Audio-Aufnahme. Bitte lade eine Audio-Datei hoch.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setLiveStream(stream)
      setHasMicPermission(true)

      // WEBM ist vom Secretary-Service unterstützt (WEBM).
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

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          const file = new File([blob], "interview.webm", { type: blob.type })
          await transcribeAudio(file)
        } finally {
          // Stream clean up
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          setLiveStream(null)
          mediaRecorderRef.current = null
          audioChunksRef.current = []
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch (e) {
      setHasMicPermission(false)
      const msg = e instanceof Error ? e.message : "Mikrofon-Zugriff fehlgeschlagen."
      setErrorMessage(msg)
    }
  }

  function stopRecording(): void {
    setErrorMessage(null)
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state !== "inactive") recorder.stop()
    setIsRecording(false)
  }

  // handleAudioFileSelect wurde entfernt, da nicht verwendet
  // Audio-Dateien werden direkt über transcribeAudio verarbeitet

  /**
   * Erstellt eine Quelle aus dem aktuellen Input (wird beim Verlassen des Steps aufgerufen).
   * Verwendet die ID der bestehenden Text-Quelle, falls vorhanden, damit sie aktualisiert wird.
   */
  const createSourceFromInput = (): WizardSource | null => {
    if (!input.trim()) return null
    
    if (source.type === "url") {
      // URL-Quellen werden bereits automatisch hinzugefügt bei handleExtractFromWebsite
      return null
    }
    
    if (source.type === "spoken" || source.type === "text") {
      // Verwende die ID der bestehenden Text-Quelle, falls vorhanden
      const existingTextSource = sources.find(s => s.kind === 'text')
      return {
        id: existingTextSource?.id || `text-${Date.now()}`,
        kind: 'text',
        text: input.trim(),
        createdAt: existingTextSource?.createdAt || new Date(),
      }
    }
    
    return null
  }

  // Exponiere createSourceFromInput für den Wizard über window (temporär)
  useEffect(() => {
    // Temporäre Lösung: Exponiere Funktion für Wizard über window-Objekt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__collectSourceStepBeforeLeave = createSourceFromInput
    return () => {
      // Temporäre Lösung: Entferne Funktion vom window-Objekt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__collectSourceStepBeforeLeave
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, source.type]) // createSourceFromInput absichtlich nicht in Dependencies, da es bei jedem Render neu erstellt wird

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl sm:text-3xl">
            {source.type === "url" 
              ? "Link einfügen" 
              : source.type === "spoken" || source.type === "text" 
                ? "Erzähl mir von der Veranstaltung" 
                : "Datei hochladen"}
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            {source.type === "url"
              ? "Füge den Link zur Event-Seite ein"
              : source.type === "spoken" || source.type === "text"
                ? "Tippe oder diktiere alle wichtigen Infos"
                : source.helpText || "Lade eine Datei hoch"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Unified Text-Quelle: tippen oder diktieren - vereinfacht */}
        {(source.type === "spoken" || source.type === "text") && (
          <div className="space-y-6">
            {/* Großer Diktier-Button (wenn verfügbar) */}
            {canUseMediaRecorder && (
              <div className="relative">
                {/* Oszilloskop im Hintergrund (nur während Aufnahme) */}
                {isRecording && liveStream && (
                  <div className="absolute inset-0 rounded-lg overflow-hidden opacity-20 pointer-events-none">
                    <AudioOscilloscope stream={liveStream} isActive={true} />
                  </div>
                )}
                <Button
                  type="button"
                  onClick={() => (isRecording ? stopRecording() : void startRecording())}
                  disabled={isTranscribing || isExtracting}
                  size="lg"
                  className={`relative w-full h-16 text-lg font-medium z-10 ${
                    isRecording
                      ? "bg-red-50 border-red-500 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-blue-50 border-blue-500 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                  }`}
                  variant="outline"
                >
                  {isRecording ? (
                    <>
                      <Mic className="w-6 h-6 mr-3 animate-pulse" />
                      Aufnahme stoppen ({recordingSeconds}s)
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 mr-3" />
                      Jetzt sprechen
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Großes Textfeld */}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className="w-full resize-none text-lg border-2 focus:border-blue-500"
              placeholder="z.B.: Am 15. Januar findet ein Workshop zum Thema KI statt. Der Eintritt ist frei..."
              disabled={isExtracting || isTranscribing}
            />

            {/* Status-Meldungen */}
            {isTranscribing && (
              <p className="text-sm text-muted-foreground text-center">
                Audio wird verarbeitet…
              </p>
            )}
            {hasMicPermission === false && canUseMediaRecorder && (
              <p className="text-xs text-muted-foreground text-center">
                Mikrofon ist nicht verfügbar. Bitte tippe den Text direkt ein.
              </p>
            )}
            {errorMessage && (
              <p className="text-sm text-destructive text-center">
                {errorMessage}
              </p>
            )}
          </div>
        )}

        {source.type === "url" && (
          <div className="space-y-6">
            <Input
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://beispiel.de/veranstaltung"
              className="w-full text-xl border-2 focus:border-blue-500 h-14 px-5"
              disabled={isExtracting || isExtractingUrl}
            />
            <Button
              onClick={() => void handleExtractFromWebsite()}
              disabled={!input.trim() || isExtractingUrl || isExtracting}
              size="lg"
              className="w-full h-14 text-lg font-semibold"
            >
              {isExtractingUrl ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Link className="w-5 h-5 mr-2" />
                  Weiter
                </>
              )}
            </Button>
            {errorMessage && (
              <p className="text-sm text-destructive text-center">
                {errorMessage}
              </p>
            )}
          </div>
        )}


        {source.type === "file" && (
          <div className="space-y-4">
            <div>
              <Label>Datei auswählen</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="mt-2"
                accept=".md,.txt,.pdf"
                disabled={isExtracting}
              />
            </div>
            {input && (
              <div className="mt-4">
                <Label>Dateiinhalt (Vorschau)</Label>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={10}
                  className="mt-2"
                  disabled={isExtracting}
                />
              </div>
            )}
            {input && onAddSource && (
              <Button 
                onClick={() => {
                  const fileSource: WizardSource = {
                    id: `file-${Date.now()}`,
                    kind: 'file',
                    fileName: fileInputRef.current?.files?.[0]?.name || 'unbekannt',
                    extractedText: input.trim(),
                    summary: input.length > 200 ? `${input.slice(0, 200)}...` : input,
                    createdAt: new Date(),
                  }
                  onAddSource(fileSource)
                  setInput("")
                  toast.success("Datei-Quelle hinzugefügt")
                }}
                disabled={isExtracting || !input.trim()}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Datei-Quelle hinzufügen
              </Button>
            )}
            {input && !onAddSource && (
              <Button onClick={handleSubmit} className="w-full" disabled={isExtracting}>
                <Upload className="w-4 h-4 mr-2" />
                Datei verwenden
              </Button>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}



