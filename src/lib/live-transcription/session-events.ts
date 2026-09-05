/**
 * @fileoverview Uebersetzung der Anbieter-Ereignisse in Journal-Eintraege
 *
 * @description
 * Baut die Ereignis-Behandlung fuer eine Verbindung. Getrennt vom Session-Manager,
 * damit dort der Ablauf (Verbinden, Wechseln, Puffern) lesbar bleibt und hier die
 * Zuordnung der Ereignisse zum Transkript.
 *
 * Zeitrechnung: Der Anbieter zaehlt je Session ab null. Weil eine lange Aufnahme aus
 * mehreren Sessions besteht, wird der Versatz der laufenden Session aufaddiert — sonst
 * begaenne die Reihenfolge nach jedem Wechsel von vorn.
 *
 * @module live-transcription
 *
 * @exports
 * - createSessionEvents: Baut die Ereignis-Behandlung einer Verbindung
 *
 * @dependencies
 * - ./realtime-socket, ./transcript-journal
 */

import type { RealtimeSocketEvents } from './realtime-socket'
import type { TranscriptJournal } from './transcript-journal'

export interface SessionEventContext {
  journal: TranscriptJournal
  /** Laufzeit der gesamten Aufnahme in Millisekunden. */
  elapsedMs: () => number
  /** Versatz der laufenden Session innerhalb der Aufnahme. */
  sessionOffsetMs: () => number
  appendPending: (delta: string) => void
  clearPending: () => void
  setSpeaking: (speaking: boolean) => void
  onOpen: () => void
  onServiceError: (message: string) => void
  onClose: (code: number, reason: string) => void
  emit: () => void
}

/** Baut die Ereignis-Behandlung fuer eine Verbindung. */
export function createSessionEvents(context: SessionEventContext): RealtimeSocketEvents {
  return {
    onOpen: () => context.onOpen(),

    onDelta: (delta) => {
      context.appendPending(delta)
      context.emit()
    },

    onCompleted: ({ itemId, transcript, audioSeconds }) => {
      // Der Abschluss nennt keine Startzeit; sie wird aus der gemeldeten Audiodauer
      // zurueckgerechnet, damit die Reihenfolge auch mit Luecken stimmt.
      const endMs = context.elapsedMs()
      const startMs = audioSeconds ? Math.max(0, endMs - audioSeconds * 1000) : endMs
      context.journal.addCompleted(itemId, transcript, startMs, endMs)
      context.clearPending()
      context.emit()
    },

    onSegment: ({ itemId, speaker, text, startMs, endMs }) => {
      const offset = context.sessionOffsetMs()
      context.journal.addSpeakerSegment({
        itemId,
        speaker,
        text,
        startMs: offset + startMs,
        endMs: offset + endMs,
      })
      context.emit()
    },

    onSpeechStarted: () => context.setSpeaking(true),
    onSpeechStopped: () => context.setSpeaking(false),

    onError: (message) => context.onServiceError(message),
    onClose: (code, reason) => context.onClose(code, reason),
  }
}
