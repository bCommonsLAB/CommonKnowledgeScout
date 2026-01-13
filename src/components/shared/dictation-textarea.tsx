"use client"

import * as React from "react"
import { Loader2, Mic } from "lucide-react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

/**
 * Ein kleines, wiederverwendbares Textfeld mit "Diktieren"-Button.
 *
 * WICHTIG:
 * - Nutzt bestehende Server-Funktionalität: `/api/secretary/process-audio`
 * - Kein Job-Queue/Background-Workflow hier. Das ist bewusst minimal.
 * - Der Nutzer kann den transkribierten Text vor dem finalen Speichern korrigieren.
 */
export function DictationTextarea(props: {
  /** Label (Frage) direkt am Feld, wie gewünscht */
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  /**
   * Optional: Wenn du das Roh-Audio zusätzlich speichern willst (z.B. zusammen mit meta.json),
   * kannst du es hier abgreifen.
   */
  onDictationAudio?: (args: { blob: Blob; mimeType: string }) => void
}) {
  const { label, value, onChange, placeholder, disabled, rows = 6, onDictationAudio } = props

  const [isRecording, setIsRecording] = React.useState(false)
  const [isTranscribing, setIsTranscribing] = React.useState(false)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const mediaStreamRef = React.useRef<MediaStream | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])

  const canUseMediaRecorder = React.useMemo(() => {
    return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator?.mediaDevices?.getUserMedia
  }, [])

  async function transcribe(file: File): Promise<string> {
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

    // Antwortformat ist in der Codebase bereits so gehandhabt (siehe EditDraftStep).
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

    if (!text.trim()) throw new Error("Keine Transkription erhalten.")
    return text.trim()
  }

  async function startRecording(): Promise<void> {
    if (!canUseMediaRecorder) {
      toast.error("Dein Browser unterstützt keine Audio-Aufnahme.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const preferredMime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : ""

      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        setIsRecording(false)
        setIsTranscribing(true)
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          if (blob.size <= 0) throw new Error("Aufnahme ist leer.")
          onDictationAudio?.({ blob, mimeType: blob.type || "audio/webm" })

          const file = new File([blob], "dictation.webm", { type: blob.type || "audio/webm" })
          const newText = await transcribe(file)
          const existing = String(value || "").trim()
          const merged = existing && newText ? `${existing}\n\n${newText}` : newText || existing
          onChange(merged)
          toast.success("Audio wurde transkribiert")
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unbekannter Fehler"
          toast.error("Audio konnte nicht verarbeitet werden", { description: msg })
        } finally {
          try {
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          } catch {}
          mediaStreamRef.current = null
          mediaRecorderRef.current = null
          audioChunksRef.current = []
          setIsTranscribing(false)
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mikrofon-Zugriff fehlgeschlagen."
      toast.error(msg)
      setIsRecording(false)
    }
  }

  function stopRecording(): void {
    try {
      mediaRecorderRef.current?.stop()
    } catch {}
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium">{label}</div>
        </div>
        <div className="shrink-0 flex items-center">
          {canUseMediaRecorder ? (
            <button
              type="button"
              onClick={() => (isRecording ? stopRecording() : void startRecording())}
              disabled={disabled || isTranscribing}
              className={`rounded-lg p-2 transition-colors ${
                isRecording
                  ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
              aria-label={isRecording ? "Aufnahme stoppen" : "Diktieren"}
              title={isRecording ? "Aufnahme stoppen" : "Diktieren"}
            >
              {isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : null}
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Hier eingeben..."}
        rows={rows}
        disabled={disabled}
      />
    </div>
  )
}

