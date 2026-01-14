"use client"

import * as React from "react"
import { toast } from "sonner"

/**
 * Merge-Strategie für Diktat-Text: Standardmäßig wird neuer Text angehängt (mit Leerzeile).
 */
export function mergeDictationText(existing: string, newText: string): string {
  const existingTrimmed = String(existing || "").trim()
  const newTrimmed = String(newText || "").trim()
  if (!newTrimmed) return existingTrimmed
  if (!existingTrimmed) return newTrimmed
  return `${existingTrimmed}\n\n${newTrimmed}`
}

export type DictationStatus = "idle" | "recording" | "transcribing" | "error"

export interface UseDictationTranscriptionOptions {
  /**
   * Endpoint für Transkription (default: `/api/secretary/process-audio`).
   * Für Public-Flows: `/api/public/secretary/process-audio`
   */
  transcribeEndpoint?: string
  /**
   * Zusätzliche FormData-Felder, die beim Transkriptions-Request mitgeschickt werden.
   * Beispiel: `{ libraryId: '...', eventFileId: '...', writeKey: '...' }`
   */
  extraFormFields?: Record<string, string>
  /**
   * Source/Target Language (default: beide 'de').
   */
  sourceLanguage?: string
  targetLanguage?: string
  /**
   * Optional: Callback, wenn Audio-Blob erzeugt wurde (vor Transkription).
   */
  onAudioBlob?: (args: { blob: Blob; mimeType: string }) => void
  /**
   * Optional: Callback für erfolgreiche Transkription (Text wird bereits gemerged zurückgegeben).
   */
  onTranscriptionComplete?: (text: string) => void
  /**
   * Merge-Strategie (default: 'append').
   */
  mergeStrategy?: "append" | "replace"
}

export interface UseDictationTranscriptionResult {
  /**
   * Aktueller Status der Diktat-Session.
   */
  status: DictationStatus
  /**
   * Live MediaStream (für Oszilloskop-Visualisierung).
   */
  liveStream: MediaStream | null
  /**
   * Startet die Aufnahme (async, kann fehlschlagen).
   */
  startRecording: () => Promise<void>
  /**
   * Stoppt die Aufnahme (triggert automatisch Transkription).
   */
  stopRecording: () => void
  /**
   * Prüft, ob MediaRecorder im Browser unterstützt wird.
   */
  canUseMediaRecorder: boolean
  /**
   * Fehlermeldung (falls vorhanden).
   */
  error: string | null
}

/**
 * Hook für Diktat-Transkription: Kapselt MediaRecorder, Stream-Lifecycle, Transkriptions-Request.
 *
 * WICHTIG:
 * - Nutzt bestehende Server-Funktionalität (Secretary Service).
 * - Synchron (kein Job-Queue).
 * - Der Nutzer kann den transkribierten Text vor dem finalen Speichern korrigieren.
 */
export function useDictationTranscription(
  options: UseDictationTranscriptionOptions = {}
): UseDictationTranscriptionResult {
  const {
    transcribeEndpoint = "/api/secretary/process-audio",
    extraFormFields = {},
    sourceLanguage = "de",
    targetLanguage = "de",
    onAudioBlob,
    onTranscriptionComplete,
    mergeStrategy = "append",
  } = options

  const [status, setStatus] = React.useState<DictationStatus>("idle")
  const [liveStream, setLiveStream] = React.useState<MediaStream | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const mediaStreamRef = React.useRef<MediaStream | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])

  const canUseMediaRecorder = React.useMemo(() => {
    return (
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      !!navigator?.mediaDevices?.getUserMedia
    )
  }, [])

  /**
   * Transkribiert eine Audio-Datei via Secretary Service.
   * Gibt nur den neuen Text zurück (ohne Merging - das macht die Komponente).
   */
  async function transcribe(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("source_language", sourceLanguage)
    formData.append("target_language", targetLanguage)

    // Zusätzliche Felder hinzufügen (z.B. libraryId, eventFileId, writeKey für Public-Flow)
    for (const [key, value] of Object.entries(extraFormFields)) {
      if (value) formData.append(key, value)
    }

    const res = await fetch(transcribeEndpoint, {
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

  const startRecording = React.useCallback(async (): Promise<void> => {
    if (!canUseMediaRecorder) {
      const msg = "Dein Browser unterstützt keine Audio-Aufnahme."
      setError(msg)
      toast.error(msg)
      setStatus("error")
      return
    }

    setError(null)
    setStatus("recording")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setLiveStream(stream)

      const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : ""

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        setStatus("transcribing")
        try {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          })
          if (blob.size <= 0) throw new Error("Aufnahme ist leer.")

          // Cleanup Stream (sofort, nicht erst nach Transkription)
          try {
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          } catch {}
          mediaStreamRef.current = null
          setLiveStream(null)

          // Callback für Audio-Blob (falls gewünscht)
          onAudioBlob?.({ blob, mimeType: blob.type || "audio/webm" })

          // Transkription
          const file = new File([blob], "dictation.webm", {
            type: blob.type || "audio/webm",
          })

          const transcribedText = await transcribe(file)

          // Callback mit neuem Text (Komponente merged selbst mit existingText)
          onTranscriptionComplete?.(transcribedText)
          toast.success("Audio wurde transkribiert")
          setStatus("idle")
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unbekannter Fehler"
          setError(msg)
          toast.error("Audio konnte nicht verarbeitet werden", { description: msg })
          setStatus("error")
        } finally {
          mediaRecorderRef.current = null
          audioChunksRef.current = []
        }
      }

      recorder.start()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mikrofon-Zugriff fehlgeschlagen."
      setError(msg)
      toast.error(msg)
      setStatus("error")
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      } catch {}
      mediaStreamRef.current = null
      setLiveStream(null)
    }
  }, [canUseMediaRecorder, transcribeEndpoint, extraFormFields, sourceLanguage, targetLanguage, onAudioBlob, onTranscriptionComplete])

  const stopRecording = React.useCallback((): void => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") return
    try {
      recorder.stop()
    } catch {
      // ignore
    }
  }, [])

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      } catch {}
      mediaStreamRef.current = null
      setLiveStream(null)
      mediaRecorderRef.current = null
      audioChunksRef.current = []
    }
  }, [])

  return {
    status,
    liveStream,
    startRecording,
    stopRecording,
    canUseMediaRecorder,
    error,
  }
}
