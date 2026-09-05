"use client"

/**
 * @fileoverview Hook fuer die Live-Transkription
 *
 * @description
 * Setzt die Teile aus `@/lib/live-transcription` zu einer bedienbaren Aufnahme
 * zusammen: Mikrofon anfordern, Ticket holen, Session fuehren, Text fortschreiben,
 * Mitschnitt lokal sichern.
 *
 * Der Text waechst waehrend des Sprechens. Was feststeht, kommt aus dem Journal; was
 * gerade erkannt wird, steht als vorlaeufiger Text daneben und wird beim Abschluss
 * eines Abschnitts uebernommen.
 *
 * @module shared
 *
 * @exports
 * - useLiveTranscription: Hook - fuehrt eine Live-Aufnahme
 * - UseLiveTranscriptionOptions, UseLiveTranscriptionResult
 *
 * @dependencies
 * - @/lib/live-transcription/*: Session, Ticket, Nacharbeit, lokale Ablage
 */

import * as React from "react"
import { toast } from "sonner"
import { LiveSession } from "@/lib/live-transcription/session-manager"
import {
  AUTHENTICATED_TICKET_ENDPOINT,
  fetchRealtimeTicket,
} from "@/lib/live-transcription/ticket-client"
import { recoverGapText } from "@/lib/live-transcription/gap-recovery"
import { openRecordingStore, type RecordingStore } from "@/lib/live-transcription/recording-store"
import type { LiveTranscriptionSnapshot } from "@/lib/live-transcription/types"

const EMPTY_SNAPSHOT: LiveTranscriptionSnapshot = {
  status: "bereit",
  connection: "getrennt",
  segments: [],
  pendingText: "",
  gaps: [],
  bufferedSeconds: 0,
  elapsedMs: 0,
  error: null,
}

export interface UseLiveTranscriptionOptions {
  /** Endpunkt fuer das Ticket (angemeldet oder oeffentlich). */
  ticketEndpoint?: string
  /** Endpunkt fuer die Nacharbeit gestoerter Abschnitte (Batch-Transkription). */
  recoveryEndpoint?: string
  /** Zusatzfelder beider Wege, z.B. libraryId/eventFileId/writeKey. */
  extraFields?: Record<string, string>
  sourceLanguage?: string
  targetLanguage?: string
  /** Begriffe, die haeufig vorkommen (Namen, Fachwoerter). */
  keywords?: string[]
  /** Wird bei jeder Textaenderung gerufen (fertiger Text ohne vorlaeufigen Teil). */
  onTextChange?: (text: string) => void
  /** Wird nach dem Beenden mit dem endgueltigen Text gerufen. */
  onFinished?: (text: string) => void
}

export interface UseLiveTranscriptionResult {
  snapshot: LiveTranscriptionSnapshot
  /** Datenstrom fuer die Pegel-Anzeige. */
  liveStream: MediaStream | null
  isRecording: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  canUseLiveTranscription: boolean
}

export function useLiveTranscription(
  options: UseLiveTranscriptionOptions = {}
): UseLiveTranscriptionResult {
  const {
    ticketEndpoint = AUTHENTICATED_TICKET_ENDPOINT,
    recoveryEndpoint = "/api/secretary/process-audio",
    extraFields,
    sourceLanguage = "de",
    targetLanguage = "de",
    keywords,
    onTextChange,
    onFinished,
  } = options

  const [snapshot, setSnapshot] = React.useState<LiveTranscriptionSnapshot>(EMPTY_SNAPSHOT)
  const [liveStream, setLiveStream] = React.useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)

  const sessionRef = React.useRef<LiveSession | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const storeRef = React.useRef<RecordingStore | null>(null)
  const recordingIdRef = React.useRef<string>("")

  // Callbacks in Refs, damit die Session nicht bei jedem Rendern neu gebaut wird.
  const textChangeRef = React.useRef(onTextChange)
  textChangeRef.current = onTextChange
  const finishedRef = React.useRef(onFinished)
  finishedRef.current = onFinished

  const canUseLiveTranscription = React.useMemo(() => {
    if (typeof window === "undefined") return false
    return (
      typeof WebSocket !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      !!navigator?.mediaDevices?.getUserMedia &&
      window.isSecureContext === true
    )
  }, [])

  const publish = React.useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    const next = session.getSnapshot()
    setSnapshot(next)
    textChangeRef.current?.(session.getText())

    const store = storeRef.current
    if (store && recordingIdRef.current) {
      void store
        .saveRecording({
          id: recordingIdRef.current,
          startedAt: Number(recordingIdRef.current.split("-")[1] || Date.now()),
          updatedAt: Date.now(),
          segments: next.segments,
          baseText: "",
          finished: false,
        })
        .catch((storeError: unknown) => {
          // Die lokale Ablage ist Rueckversicherung, kein Muss: scheitert sie, laeuft
          // die Aufnahme weiter — aber sichtbar im Protokoll.
          console.warn("[live-transcription] Journal nicht gespeichert", storeError)
        })
    }
  }, [])

  const start = React.useCallback(async (): Promise<void> => {
    if (sessionRef.current) return
    if (!canUseLiveTranscription) {
      const message = window.isSecureContext
        ? "Dieser Browser unterstuetzt die Live-Transkription nicht."
        : "Live-Transkription benoetigt eine sichere Verbindung (HTTPS) oder localhost."
      toast.error(message)
      setSnapshot({ ...EMPTY_SNAPSHOT, status: "fehler", error: message })
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (permissionError) {
      const named = permissionError as { name?: string; message?: string }
      const denied =
        named?.name === "NotAllowedError" ||
        named?.name === "PermissionDeniedError" ||
        named?.name === "SecurityError"
      const message = denied
        ? "Mikrofon-Zugriff verweigert. Bitte im Browser die Berechtigung erlauben."
        : named?.message || "Mikrofon-Zugriff fehlgeschlagen."
      toast.error(message)
      setSnapshot({ ...EMPTY_SNAPSHOT, status: "fehler", error: message })
      return
    }

    streamRef.current = stream
    setLiveStream(stream)
    recordingIdRef.current = `rec-${Date.now()}`

    try {
      storeRef.current = await openRecordingStore()
    } catch (storeError) {
      // Ohne lokale Ablage laeuft alles weiter, nur die Absturzsicherung fehlt.
      console.warn("[live-transcription] Lokale Ablage nicht verfuegbar", storeError)
      storeRef.current = null
    }

    const session = new LiveSession({
      stream,
      onChange: publish,
      fetchTicket: () =>
        fetchRealtimeTicket({
          endpoint: ticketEndpoint,
          language: sourceLanguage,
          keywords,
          extraFields,
        }),
      recoverGap: (blob) =>
        recoverGapText({
          blob,
          endpoint: recoveryEndpoint,
          extraFormFields: extraFields,
          sourceLanguage,
          targetLanguage,
        }),
      onRecordingChunk: (blob, index) => {
        const store = storeRef.current
        if (!store) return
        void store.appendChunk(recordingIdRef.current, index, blob).catch((chunkError: unknown) => {
          console.warn("[live-transcription] Mitschnitt nicht gespeichert", chunkError)
        })
      },
    })

    sessionRef.current = session
    setIsRecording(true)

    try {
      await session.start()
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Start fehlgeschlagen"
      toast.error("Live-Transkription konnte nicht starten", { description: message })
      setSnapshot({ ...EMPTY_SNAPSHOT, status: "fehler", error: message })
      sessionRef.current = null
      setIsRecording(false)
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setLiveStream(null)
    }
  }, [
    canUseLiveTranscription,
    publish,
    ticketEndpoint,
    recoveryEndpoint,
    extraFields,
    keywords,
    sourceLanguage,
    targetLanguage,
  ])

  const stop = React.useCallback(async (): Promise<void> => {
    const session = sessionRef.current
    if (!session) return

    setIsRecording(false)
    await session.stop()

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setLiveStream(null)

    const finalText = session.getText()
    setSnapshot(session.getSnapshot())
    finishedRef.current?.(finalText)

    const store = storeRef.current
    if (store && recordingIdRef.current) {
      // Die Aufnahme ist abgeschlossen und ihr Text uebergeben: der Mitschnitt wird
      // nicht mehr gebraucht und belegt sonst dauerhaft Platz im Browser.
      void store.deleteRecording(recordingIdRef.current).catch((deleteError: unknown) => {
        console.warn("[live-transcription] Journal nicht aufgeraeumt", deleteError)
      })
      store.close()
    }
    storeRef.current = null
    sessionRef.current = null
  }, [])

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      storeRef.current?.close()
      storeRef.current = null
    }
  }, [])

  return { snapshot, liveStream, isRecording, start, stop, canUseLiveTranscription }
}
