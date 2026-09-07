import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Beweis-Ziele rund um die Zusage "Gesprochenes geht nicht verloren":
 *
 * 1. Was waehrend des Verbindungsaufbaus gesprochen wird, wandert in den Puffer und geht
 *    nach dem Verbinden vollstaendig hinaus. Im Test am 07.09.2026 stand der Verdacht im
 *    Raum, dieser Anfang gehe verloren.
 * 2. Beim Beenden wird der Abschluss angefordert, damit der letzte Satz nicht im
 *    Schwebezustand haengen bleibt.
 * 3. Bleibt der Abschluss aus, wird der Schwebetext uebernommen statt verworfen.
 */

const gesendeteBloecke: string[] = []
let abschlussAngefordert = 0
/** Wie beim echten Socket: erst nach dem Open-Ereignis nimmt die Verbindung Ton an. */
let verbindungOffen = false
let pcmSenke: ((chunk: Int16Array) => void) | null = null
let socketEreignisse: {
  onOpen: () => void
  onDelta: (delta: string, itemId: string) => void
  onCompleted: (a: { itemId: string; transcript: string; audioSeconds: number | null }) => void
} | null = null

vi.mock('@/lib/live-transcription/audio-capture', () => ({
  startAudioCapture: vi.fn(async (options: { onPcm: (chunk: Int16Array) => void }) => {
    pcmSenke = options.onPcm
    return { sampleRate: 24000, stop: async () => {} }
  }),
}))

vi.mock('@/lib/live-transcription/media-recording', () => ({
  startContinuousRecording: vi.fn(() => ({ stop: async () => null })),
  startGapRecording: vi.fn(() => ({ stop: async () => null })),
}))

vi.mock('@/lib/live-transcription/realtime-socket', () => ({
  openRealtimeSocket: vi.fn((_ticket: unknown, events: NonNullable<typeof socketEreignisse>) => {
    socketEreignisse = events
    return {
      sendAudio: (base64: string) => gesendeteBloecke.push(base64),
      commitAudio: () => {
        abschlussAngefordert += 1
      },
      isOpen: () => verbindungOffen,
      close: () => {
        verbindungOffen = false
      },
    }
  }),
}))

const { LiveSession } = await import('@/lib/live-transcription/session-manager')

function neueSession(): InstanceType<typeof LiveSession> {
  return new LiveSession({
    stream: {} as MediaStream,
    fetchTicket: async () => ({
      value: 'ek_test',
      expiresAt: null,
      model: 'gpt-live-transcribe',
      websocketUrl: 'wss://example.test',
    }),
    recoverGap: async () => '',
    onChange: () => {},
  })
}

/** Ein Block Ton, wie ihn die Erfassung liefert (100 ms bei 24 kHz). */
function tonBlock(): Int16Array {
  return new Int16Array(2400)
}

/** Stellt die Verbindung her — wie der echte Socket erst mit dem Open-Ereignis. */
function verbindungHerstellen(): void {
  verbindungOffen = true
  socketEreignisse?.onOpen()
}

beforeEach(() => {
  gesendeteBloecke.length = 0
  verbindungOffen = false
  abschlussAngefordert = 0
  pcmSenke = null
  socketEreignisse = null
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LiveSession — Verlustsicherung', () => {
  it('sendet den Ton aus der Aufbauphase nach dem Verbinden nach', async () => {
    const session = neueSession()
    await session.start()

    // Waehrend des Aufbaus gesprochen: die Verbindung meldet sich noch nicht.
    pcmSenke?.(tonBlock())
    pcmSenke?.(tonBlock())
    pcmSenke?.(tonBlock())
    expect(gesendeteBloecke).toHaveLength(0)

    verbindungHerstellen()
    await vi.advanceTimersByTimeAsync(300) // Nachsende-Runden

    expect(gesendeteBloecke).toHaveLength(3)
  })

  it('fordert beim Beenden den Abschluss des letzten Satzes an', async () => {
    const session = neueSession()
    await session.start()
    verbindungHerstellen()
    socketEreignisse?.onDelta('Ein halber Satz', 'item-1')

    const beenden = session.stop()
    // Der Anbieter liefert das Schlusstranskript.
    socketEreignisse?.onCompleted({ itemId: 'item-1', transcript: 'Ein halber Satz', audioSeconds: 2 })
    await beenden

    expect(abschlussAngefordert).toBe(1)
    expect(session.getText()).toContain('Ein halber Satz')
  })

  it('uebernimmt den Schwebetext, wenn kein Abschluss kommt', async () => {
    const session = neueSession()
    await session.start()
    verbindungHerstellen()
    socketEreignisse?.onDelta('Text ohne Abschluss', 'item-1')

    const beenden = session.stop()
    await vi.advanceTimersByTimeAsync(3500) // Frist verstreichen lassen
    await beenden

    expect(session.getText()).toContain('Text ohne Abschluss')
  })
})
