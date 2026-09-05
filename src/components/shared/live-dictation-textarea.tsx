"use client"

/**
 * @fileoverview Textfeld mit Live-Diktat
 *
 * @description
 * Wie `DictationTextarea`, aber der Text erscheint waehrend des Sprechens statt erst
 * nach dem Loslassen. Bewusst eine eigene Komponente: Der bewaehrte Weg (aufnehmen,
 * dann am Stueck transkribieren) bleibt dadurch unangetastet und dient weiter als
 * Rueckfallebene, wenn die Live-Verbindung nicht zustande kommt.
 *
 * Der noch nicht abgeschlossene Text steht unter dem Feld statt darin: So springt
 * nichts unter dem Cursor herum, wenn der Dienst eine Formulierung nachbessert.
 *
 * @module shared
 *
 * @exports
 * - LiveDictationTextarea: Komponente - Textfeld mit Live-Diktat
 *
 * @dependencies
 * - ./use-live-transcription: Fuehrt die Aufnahme
 * - ./live-status-line: Zustandsanzeige
 * - ./audio-oscilloscope: Pegelanzeige
 */

import * as React from "react"
import { Mic, Square } from "lucide-react"
import { Textarea } from "@ks/ui"
import { useLiveTranscription, type UseLiveTranscriptionOptions } from "./use-live-transcription"
import { LiveStatusLine } from "./live-status-line"
import { AudioOscilloscope } from "./audio-oscilloscope"
import { mergeDictationText } from "./use-dictation-transcription"

export interface LiveDictationTextareaProps {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  showOscilloscope?: boolean
  /** Endpunkt fuer das Ticket (oeffentlicher Weg braucht den public-Endpunkt). */
  ticketEndpoint?: string
  /** Endpunkt fuer die Nacharbeit gestoerter Abschnitte. */
  recoveryEndpoint?: string
  /** Zusatzfelder beider Wege, z.B. libraryId/eventFileId/writeKey. */
  extraFields?: Record<string, string>
  sourceLanguage?: string
  targetLanguage?: string
  /** Begriffe, die haeufig vorkommen (Namen, Fachwoerter). */
  keywords?: string[]
  className?: string
}

export function LiveDictationTextarea(props: LiveDictationTextareaProps) {
  const {
    label,
    value,
    onChange,
    placeholder,
    disabled,
    rows = 6,
    showOscilloscope = true,
    ticketEndpoint,
    recoveryEndpoint,
    extraFields,
    sourceLanguage,
    targetLanguage,
    keywords,
    className,
  } = props

  // Der Text, der beim Start im Feld stand. Das Diktat haengt daran an, statt ihn zu
  // ersetzen — sonst waere eine begonnene Eingabe weg.
  const baseTextRef = React.useRef("")
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  const handleTextChange = React.useCallback((text: string) => {
    onChangeRef.current(mergeDictationText(baseTextRef.current, text))
  }, [])

  const liveOptions: UseLiveTranscriptionOptions = React.useMemo(
    () => ({
      ticketEndpoint,
      recoveryEndpoint,
      extraFields,
      sourceLanguage,
      targetLanguage,
      keywords,
      onTextChange: handleTextChange,
    }),
    [ticketEndpoint, recoveryEndpoint, extraFields, sourceLanguage, targetLanguage, keywords, handleTextChange]
  )

  const { snapshot, liveStream, isRecording, start, stop, canUseLiveTranscription } =
    useLiveTranscription(liveOptions)

  const handleMicClick = React.useCallback(() => {
    if (isRecording) {
      void stop()
      return
    }
    baseTextRef.current = value
    void start()
  }, [isRecording, start, stop, value])

  return (
    <div className={className}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 text-sm font-medium">{label}</div>
          {canUseLiveTranscription ? (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={disabled}
              className={`shrink-0 rounded-lg p-2 transition-colors ${
                isRecording
                  ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
              aria-label={isRecording ? "Aufnahme beenden" : "Live diktieren"}
              title={isRecording ? "Aufnahme beenden" : "Live diktieren"}
            >
              {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : null}
        </div>

        {showOscilloscope && isRecording && liveStream ? (
          <AudioOscilloscope stream={liveStream} isActive={true} />
        ) : null}

        <LiveStatusLine snapshot={snapshot} />

        {snapshot.error ? <div className="text-xs text-destructive">{snapshot.error}</div> : null}

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Hier eingeben oder diktieren..."}
          rows={rows}
          disabled={disabled}
          aria-label={label}
        />

        {snapshot.pendingText ? (
          <div className="rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-400 dark:bg-slate-900/40 dark:text-slate-500">
            {snapshot.pendingText}
          </div>
        ) : null}
      </div>
    </div>
  )
}
