import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { openRealtimeSocket, type RealtimeSocketEvents } from '@/lib/live-transcription/realtime-socket'
import type { RealtimeTicket } from '@/lib/live-transcription/types'

/**
 * Beweis-Ziel: Die Verbindung wird in der GA-Form aufgebaut.
 *
 * Hintergrund: Ein drittes Unterprotokoll ('openai-beta.realtime-v1') waehlt die
 * abgeschaltete Beta-Form. Der Anbieter lehnt die Verbindung dann mit
 * 'beta_api_shape_disabled' ab — im Betrieb aufgefallen, hier festgehalten.
 */

interface Listener {
  (event: unknown): void
}

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  static lastUrl = ''
  static lastProtocols: string[] = []
  static last: FakeWebSocket | null = null

  readyState = FakeWebSocket.OPEN
  sent: string[] = []
  private readonly listeners = new Map<string, Listener[]>()

  constructor(url: string, protocols?: string | string[]) {
    FakeWebSocket.lastUrl = url
    FakeWebSocket.lastProtocols = Array.isArray(protocols) ? protocols : protocols ? [protocols] : []
    FakeWebSocket.last = this
  }

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) || []
    existing.push(listener)
    this.listeners.set(type, existing)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
  }

  /** Stösst ein Ereignis an, als käme es vom Anbieter. */
  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) || []) listener(event)
  }
}

const TICKET: RealtimeTicket = {
  value: 'ek_test123',
  expiresAt: null,
  model: 'gpt-live-transcribe',
  websocketUrl: 'wss://api.openai.com/v1/realtime?intent=transcription',
}

function noopEvents(): RealtimeSocketEvents {
  return {
    onOpen: vi.fn(),
    onDelta: vi.fn(),
    onCompleted: vi.fn(),
    onSegment: vi.fn(),
    onSpeechStarted: vi.fn(),
    onSpeechStopped: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket)
  FakeWebSocket.lastUrl = ''
  FakeWebSocket.lastProtocols = []
  FakeWebSocket.last = null
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('openRealtimeSocket', () => {
  it('verbindet ohne das abgeschaltete Beta-Unterprotokoll', () => {
    openRealtimeSocket(TICKET, noopEvents())

    expect(FakeWebSocket.lastProtocols).not.toContain('openai-beta.realtime-v1')
    expect(FakeWebSocket.lastProtocols.some((p) => p.startsWith('openai-beta.'))).toBe(false)
  })

  it('schickt Kennung und Ticket als Unterprotokolle', () => {
    openRealtimeSocket(TICKET, noopEvents())

    expect(FakeWebSocket.lastProtocols).toEqual(['realtime', 'openai-insecure-api-key.ek_test123'])
  })

  it('nutzt die Adresse aus dem Ticket', () => {
    openRealtimeSocket(TICKET, noopEvents())

    expect(FakeWebSocket.lastUrl).toBe('wss://api.openai.com/v1/realtime?intent=transcription')
  })

  /**
   * Beweis-Ziel: Der Abschluss wird angefordert.
   *
   * Hintergrund: Das Modell laeuft ohne serverseitige Sprechpausen-Erkennung und sendet
   * deshalb nur Teilstuecke. Ohne 'input_audio_buffer.commit' kommt nie ein
   * abschliessendes Transkript — gemessen am 07.09.2026: 17 Teilstuecke, kein Abschluss.
   */
  it('fordert mit commitAudio das Schlusstranskript an', () => {
    const handle = openRealtimeSocket(TICKET, noopEvents())

    handle.commitAudio()

    expect(FakeWebSocket.last?.sent).toContain(JSON.stringify({ type: 'input_audio_buffer.commit' }))
  })

  it('schickt keinen Abschluss ueber eine geschlossene Verbindung', () => {
    const handle = openRealtimeSocket(TICKET, noopEvents())
    FakeWebSocket.last?.close()

    handle.commitAudio()

    expect(FakeWebSocket.last?.sent).toHaveLength(0)
  })

  it('rechnet Sprecher-Abschnitte von Sekunden in Millisekunden um', () => {
    const events = noopEvents()
    openRealtimeSocket(TICKET, events)

    FakeWebSocket.last?.emit('message', {
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.segment',
        item_id: 'item-1',
        speaker: 'Sprecher A',
        text: 'Guten Morgen',
        start: 1.5,
        end: 4.25,
      }),
    })

    expect(events.onSegment).toHaveBeenCalledWith({
      itemId: 'item-1',
      speaker: 'Sprecher A',
      text: 'Guten Morgen',
      startMs: 1500,
      endMs: 4250,
    })
  })

  it('liest die Audiodauer aus dem Abschluss-Ereignis', () => {
    const events = noopEvents()
    openRealtimeSocket(TICKET, events)

    FakeWebSocket.last?.emit('message', {
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item-2',
        transcript: 'Ein ganzer Satz.',
        usage: { type: 'duration', seconds: 3.5 },
      }),
    })

    expect(events.onCompleted).toHaveBeenCalledWith({
      itemId: 'item-2',
      transcript: 'Ein ganzer Satz.',
      audioSeconds: 3.5,
    })
  })

  it('meldet unlesbare Nachrichten, statt sie zu verschlucken', () => {
    const events = noopEvents()
    openRealtimeSocket(TICKET, events)

    FakeWebSocket.last?.emit('message', { data: 'kein json' })

    expect(events.onError).toHaveBeenCalledWith('Unlesbare Nachricht vom Transkriptionsdienst')
  })

  it('reicht Fehler des Dienstes mit ihrer Meldung weiter', () => {
    const events = noopEvents()
    openRealtimeSocket(TICKET, events)

    FakeWebSocket.last?.emit('message', {
      data: JSON.stringify({
        type: 'error',
        error: { message: 'The Realtime Beta API is no longer supported.' },
      }),
    })

    expect(events.onError).toHaveBeenCalledWith('The Realtime Beta API is no longer supported.')
  })
})
