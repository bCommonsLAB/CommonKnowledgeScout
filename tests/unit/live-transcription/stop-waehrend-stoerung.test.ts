// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Beweis-Ziel: Wer waehrend einer Netzstoerung auf Stopp drueckt, verliert nichts.
 *
 * Hintergrund: Im Test am 07.09.2026 kam der Text vor der Stoerung an, der waehrend der
 * Stoerung gesprochene war weg — auch nachdem die Verbindung zurueck war. Dieser Test
 * faehrt den Ablauf nach: verbinden, sprechen, Verbindung verlieren, weitersprechen,
 * stoppen, wieder online gehen.
 */

const gapBloecke: Blob[] = []
let nacharbeitVersuche = 0
let nacharbeitScheitertBis = 1
let verbindungOffen = false
let pcmSenke: ((chunk: Int16Array) => void) | null = null
let socketEreignisse: {
  onOpen: () => void
  onDelta: (delta: string, itemId: string) => void
  onCompleted: (a: { itemId: string; transcript: string; audioSeconds: number | null }) => void
  onClose: (code: number, reason: string) => void
} | null = null

vi.mock('@/lib/live-transcription/audio-capture', () => ({
  startAudioCapture: vi.fn(async (options: { onPcm: (chunk: Int16Array) => void }) => {
    pcmSenke = options.onPcm
    return { sampleRate: 24000, stop: async () => {} }
  }),
}))

vi.mock('@/lib/live-transcription/media-recording', () => ({
  startContinuousRecording: vi.fn(() => ({ stop: async () => null })),
  // Der Mitschnitt der Stoerung liefert echten Inhalt — sonst waere die Luecke von
  // vornherein 'gescheitert' und der Test wuerde am falschen Punkt gruen.
  startGapRecording: vi.fn(() => ({
    stop: async () => {
      const blob = new Blob(['ton-der-stoerung'])
      gapBloecke.push(blob)
      return blob
    },
  })),
}))

vi.mock('@/lib/live-transcription/realtime-socket', () => ({
  openRealtimeSocket: vi.fn((_ticket: unknown, events: NonNullable<typeof socketEreignisse>) => {
    socketEreignisse = events
    return {
      sendAudio: () => {},
      commitAudio: () => {},
      isOpen: () => verbindungOffen,
      close: () => {
        verbindungOffen = false
      },
    }
  }),
}))

const { LiveSession } = await import('@/lib/live-transcription/session-manager')

function setzeNetz(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

function tonBlock(): Int16Array {
  return new Int16Array(2400)
}

function neueSession(): InstanceType<typeof LiveSession> {
  return new LiveSession({
    stream: {} as MediaStream,
    fetchTicket: async () => {
      if (!navigator.onLine) throw new Error('Failed to fetch')
      return {
        value: 'ek_test',
        expiresAt: null,
        model: 'gpt-live-transcribe',
        websocketUrl: 'wss://example.test',
      }
    },
    recoverGap: async () => {
      nacharbeitVersuche += 1
      if (nacharbeitVersuche <= nacharbeitScheitertBis) throw new Error('Failed to fetch')
      return 'der Satz aus der Stoerung'
    },
    onChange: () => {},
  })
}

beforeEach(() => {
  gapBloecke.length = 0
  nacharbeitVersuche = 0
  nacharbeitScheitertBis = 1
  verbindungOffen = false
  pcmSenke = null
  socketEreignisse = null
  setzeNetz(true)
})

afterEach(() => {
  setzeNetz(true)
})

describe('Stopp waehrend einer Netzstoerung', () => {
  it('verliert den waehrend der Stoerung gesprochenen Text nicht', async () => {
    const session = neueSession()
    await session.start()

    verbindungOffen = true
    socketEreignisse?.onOpen()
    socketEreignisse?.onDelta('Erster Satz vor der Stoerung.', 'item-1')
    socketEreignisse?.onCompleted({
      itemId: 'item-1',
      transcript: 'Erster Satz vor der Stoerung.',
      audioSeconds: 3,
    })

    // Das Netz faellt aus: der Anbieter schliesst die Verbindung.
    setzeNetz(false)
    verbindungOffen = false
    socketEreignisse?.onClose(1006, 'network')

    // Waehrend der Stoerung wird weitergesprochen.
    pcmSenke?.(tonBlock())
    pcmSenke?.(tonBlock())

    await session.stop()

    // Der Ton der Stoerung liegt als Mitschnitt vor und wartet auf Nacharbeit.
    expect(gapBloecke.length).toBeGreaterThan(0)
    const luecken = session.getSnapshot().gaps
    expect(luecken).toHaveLength(1)
    expect(luecken[0].state).toBe('wartet')
    expect(session.getText()).toContain('Erster Satz vor der Stoerung.')

    // Das Netz kommt zurueck: die Nacharbeit wird von selbst wieder aufgenommen.
    setzeNetz(true)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(nacharbeitVersuche).toBe(2))
    await vi.waitFor(() => expect(session.getSnapshot().gaps).toHaveLength(0))

    expect(session.getText()).toContain('der Satz aus der Stoerung')
  })
})
