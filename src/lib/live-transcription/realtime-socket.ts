/**
 * @fileoverview WebSocket-Verbindung zur Live-Transkription
 *
 * @description
 * Oeffnet die Verbindung zum Realtime-Endpunkt des Anbieters und uebersetzt dessen
 * Ereignisse in die Begriffe dieser Anwendung. Die Anmeldung laeuft ueber ein
 * kurzlebiges Ticket, das als WebSocket-Unterprotokoll mitgeschickt wird — im Browser
 * lassen sich keine Kopfzeilen setzen.
 *
 * Bewusst ohne eigene Wiederverbindung: die gehoert in den Session-Manager, der auch
 * das Puffern und die Luecken kennt.
 *
 * @module live-transcription
 *
 * @exports
 * - RealtimeSocketHandle: Interface - Griff zum Senden und Schliessen
 * - openRealtimeSocket: Baut die Verbindung auf
 *
 * @dependencies
 * - ./types: RealtimeTicket
 */

import type { RealtimeTicket } from './types'

/** Ereignisse, die der Session-Manager verarbeitet. */
export interface RealtimeSocketEvents {
  onOpen: () => void
  /** Zwischenstand des laufenden Abschnitts. */
  onDelta: (delta: string, itemId: string) => void
  /** Abgeschlossener Abschnitt. */
  onCompleted: (payload: { itemId: string; transcript: string; audioSeconds: number | null }) => void
  /** Abschnitt mit Sprecher-Label (nur bei Modellen mit Sprecher-Erkennung). */
  onSegment: (payload: {
    itemId: string
    speaker: string
    text: string
    startMs: number
    endMs: number
  }) => void
  onSpeechStarted: () => void
  onSpeechStopped: () => void
  onError: (message: string) => void
  onClose: (code: number, reason: string) => void
}

export interface RealtimeSocketHandle {
  /** Schickt einen PCM-Block (Base64) an den Anbieter. */
  sendAudio: (base64: string) => void
  /** True, solange die Verbindung Daten annimmt. */
  isOpen: () => boolean
  /** Schliesst die Verbindung; danach kommen keine Ereignisse mehr. */
  close: () => void
}

interface ServerEvent {
  type?: unknown
  delta?: unknown
  transcript?: unknown
  item_id?: unknown
  speaker?: unknown
  text?: unknown
  start?: unknown
  end?: unknown
  usage?: { type?: unknown; seconds?: unknown }
  error?: { message?: unknown; code?: unknown }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Oeffnet die Verbindung. Das Ticket wandert als Unterprotokoll mit; es ist kurzlebig
 * und auf Transkriptions-Sessions beschraenkt.
 */
export function openRealtimeSocket(
  ticket: RealtimeTicket,
  events: RealtimeSocketEvents
): RealtimeSocketHandle {
  const socket = new WebSocket(ticket.websocketUrl, [
    'realtime',
    `openai-insecure-api-key.${ticket.value}`,
    'openai-beta.realtime-v1',
  ])

  socket.addEventListener('open', () => events.onOpen())

  socket.addEventListener('message', (message: MessageEvent) => {
    if (typeof message.data !== 'string') return

    let parsed: ServerEvent
    try {
      parsed = JSON.parse(message.data) as ServerEvent
    } catch {
      // Unlesbare Nachricht: melden statt verschlucken, damit Protokollaenderungen auffallen.
      events.onError('Unlesbare Nachricht vom Transkriptionsdienst')
      return
    }

    const type = readString(parsed.type)
    switch (type) {
      case 'conversation.item.input_audio_transcription.delta':
        events.onDelta(readString(parsed.delta), readString(parsed.item_id))
        return
      case 'conversation.item.input_audio_transcription.completed':
        events.onCompleted({
          itemId: readString(parsed.item_id),
          transcript: readString(parsed.transcript),
          audioSeconds:
            parsed.usage && readString(parsed.usage.type) === 'duration'
              ? readSeconds(parsed.usage.seconds)
              : null,
        })
        return
      case 'conversation.item.input_audio_transcription.segment':
        events.onSegment({
          itemId: readString(parsed.item_id),
          speaker: readString(parsed.speaker),
          text: readString(parsed.text),
          startMs: readSeconds(parsed.start) * 1000,
          endMs: readSeconds(parsed.end) * 1000,
        })
        return
      case 'conversation.item.input_audio_transcription.failed':
        events.onError(readString(parsed.error?.message) || 'Transkription fehlgeschlagen')
        return
      case 'input_audio_buffer.speech_started':
        events.onSpeechStarted()
        return
      case 'input_audio_buffer.speech_stopped':
        events.onSpeechStopped()
        return
      case 'error':
        events.onError(readString(parsed.error?.message) || 'Fehler des Transkriptionsdienstes')
        return
      default:
        // Statusereignisse (Session bestaetigt, Puffer geleert, ...) brauchen hier keine
        // Behandlung. Sie werden absichtlich uebergangen, nicht versehentlich.
        return
    }
  })

  socket.addEventListener('error', () => {
    // Das Fehlerereignis des Browsers nennt keine Ursache; der Grund steht im
    // anschliessenden Schliessen-Ereignis.
    events.onError('Verbindung zum Transkriptionsdienst gestoert')
  })

  socket.addEventListener('close', (event: CloseEvent) => {
    events.onClose(event.code, event.reason)
  })

  return {
    sendAudio: (base64: string) => {
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }))
    },
    isOpen: () => socket.readyState === WebSocket.OPEN,
    close: () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    },
  }
}
