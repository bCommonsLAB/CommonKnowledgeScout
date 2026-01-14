"use client"

import * as React from "react"
import { Loader2, Mic } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { useDictationTranscription, mergeDictationText, type UseDictationTranscriptionOptions } from "./use-dictation-transcription"
import { AudioOscilloscope } from "./audio-oscilloscope"

/**
 * Einheitliche, wiederverwendbare Textarea mit "Diktieren"-Button und optionalem Oszilloskop.
 *
 * WICHTIG:
 * - Nutzt bestehende Server-Funktionalität (Secretary Service).
 * - Synchron (kein Job-Queue/Background-Workflow).
 * - Der Nutzer kann den transkribierten Text vor dem finalen Speichern korrigieren.
 * - Standardmäßig wird neuer Text angehängt (mit Leerzeile).
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
  /**
   * Optional: Zeige Live-Oszilloskop während der Aufnahme (default: false).
   */
  showOscilloscope?: boolean
  /**
   * Optional: Endpoint für Transkription (default: `/api/secretary/process-audio`).
   * Für Public-Flows: `/api/public/secretary/process-audio`
   */
  transcribeEndpoint?: string
  /**
   * Optional: Zusätzliche FormData-Felder für Transkriptions-Request.
   * Beispiel: `{ libraryId: '...', eventFileId: '...', writeKey: '...' }`
   */
  extraFormFields?: Record<string, string>
  /**
   * Optional: Source/Target Language (default: beide 'de').
   */
  sourceLanguage?: string
  targetLanguage?: string
  /**
   * Optional: Layout-Variante (default: 'default').
   * - 'default': Label oben, Button rechts daneben, Textarea darunter
   * - 'inline': Label links, Button rechts, Textarea darunter (kompakter)
   */
  variant?: "default" | "inline"
  /**
   * Optional: CSS-Klassen für Container.
   */
  className?: string
}) {
  const {
    label,
    value,
    onChange,
    placeholder,
    disabled,
    rows = 6,
    onDictationAudio,
    showOscilloscope = false,
    transcribeEndpoint,
    extraFormFields,
    sourceLanguage,
    targetLanguage,
    variant = "default",
    className,
  } = props

  const handleTranscriptionComplete = React.useCallback(
    (newText: string) => {
      const merged = mergeDictationText(value, newText)
      onChange(merged)
    },
    [value, onChange]
  )

  const dictationOptions: UseDictationTranscriptionOptions = React.useMemo(
    () => ({
      transcribeEndpoint,
      extraFormFields,
      sourceLanguage,
      targetLanguage,
      onAudioBlob: onDictationAudio,
      onTranscriptionComplete: handleTranscriptionComplete,
      mergeStrategy: "append",
    }),
    [transcribeEndpoint, extraFormFields, sourceLanguage, targetLanguage, onDictationAudio, handleTranscriptionComplete]
  )

  const { status, liveStream, startRecording, stopRecording, canUseMediaRecorder } =
    useDictationTranscription(dictationOptions)

  const isRecording = status === "recording"
  const isTranscribing = status === "transcribing"

  const handleMicClick = React.useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      void startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  return (
    <div className={className}>
      <div className="space-y-2">
        {variant === "default" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{label}</div>
              </div>
              <div className="shrink-0 flex items-center">
                {canUseMediaRecorder ? (
                  <button
                    type="button"
                    onClick={handleMicClick}
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
            {showOscilloscope && isRecording && liveStream ? (
              <AudioOscilloscope stream={liveStream} isActive={true} />
            ) : null}
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || "Hier eingeben..."}
              rows={rows}
              disabled={disabled}
            />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium flex-1">{label}</div>
              {canUseMediaRecorder ? (
                <button
                  type="button"
                  onClick={handleMicClick}
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
            {showOscilloscope && isRecording && liveStream ? (
              <AudioOscilloscope stream={liveStream} isActive={true} />
            ) : null}
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || "Hier eingeben..."}
              rows={rows}
              disabled={disabled}
            />
          </>
        )}
      </div>
    </div>
  )
}

