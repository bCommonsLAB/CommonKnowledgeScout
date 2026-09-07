// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

/**
 * Beweis-Ziel: Der nach einem Netzausfall nachgearbeitete Text landet im Textfeld.
 *
 * Hintergrund: Am 07.09.2026 war der Text zwar gerettet — Mitschnitt vorhanden, Luecke
 * wartend, Nacharbeit nach Rueckkehr des Netzes erfolgreich —, kam aber nie an: Der
 * Nachlauf meldete ueber `onFinished`, und genau diesen Rueckruf setzt die
 * Diktat-Komponente nicht. Das Feld haengt an `onTextChange`.
 */

let nacharbeitVersuche = 0
let verbindungOffen = false
let socketEreignisse: {
  onOpen: () => void
  onDelta: (delta: string, itemId: string) => void
  onCompleted: (a: { itemId: string; transcript: string; audioSeconds: number | null }) => void
  onClose: (code: number, reason: string) => void
} | null = null

vi.mock('@/lib/live-transcription/audio-capture', () => ({
  startAudioCapture: vi.fn(async () => ({ sampleRate: 24000, stop: async () => {} })),
}))

vi.mock('@/lib/live-transcription/media-recording', () => ({
  startContinuousRecording: vi.fn(() => ({ stop: async () => null })),
  startGapRecording: vi.fn(() => ({ stop: async () => new Blob(['ton-der-stoerung']) })),
}))

vi.mock('@/lib/live-transcription/realtime-socket', () => ({
  openRealtimeSocket: vi.fn((_t: unknown, events: NonNullable<typeof socketEreignisse>) => {
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

vi.mock('@/lib/live-transcription/ticket-client', () => ({
  AUTHENTICATED_TICKET_ENDPOINT: '/api/secretary/realtime-session',
  fetchRealtimeTicket: vi.fn(async () => ({
    value: 'ek_test',
    expiresAt: null,
    model: 'gpt-live-transcribe',
    websocketUrl: 'wss://example.test',
  })),
}))

vi.mock('@/lib/live-transcription/gap-recovery', () => ({
  recoverGapText: vi.fn(async () => {
    nacharbeitVersuche += 1
    if (nacharbeitVersuche <= 1) throw new Error('Failed to fetch')
    return 'der Satz aus der Stoerung'
  }),
}))

vi.mock('@/lib/live-transcription/recording-store', () => ({
  openRecordingStore: vi.fn(async () => ({
    saveRecording: async () => {},
    appendChunk: async () => {},
    deleteRecording: async () => {},
    close: () => {},
  })),
}))

const { useLiveTranscription } = await import('@/components/shared/use-live-transcription')

function setzeNetz(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

beforeEach(() => {
  nacharbeitVersuche = 0
  verbindungOffen = false
  socketEreignisse = null
  setzeNetz(true)
  vi.stubGlobal('MediaRecorder', class {})
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: async () => ({ getTracks: () => [] }) as unknown as MediaStream },
    configurable: true,
  })
})

afterEach(() => {
  setzeNetz(true)
  vi.unstubAllGlobals()
})

describe('Nacharbeit nach Netzausfall', () => {
  it('schreibt den nachgearbeiteten Text ins Feld', async () => {
    const textAenderungen: string[] = []
    const { result } = renderHook(() =>
      useLiveTranscription({ onTextChange: (text) => textAenderungen.push(text) })
    )

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      verbindungOffen = true
      socketEreignisse?.onOpen()
      socketEreignisse?.onDelta('Erster Satz.', 'item-1')
      socketEreignisse?.onCompleted({ itemId: 'item-1', transcript: 'Erster Satz.', audioSeconds: 2 })
    })

    // Netzausfall, danach beenden.
    await act(async () => {
      setzeNetz(false)
      verbindungOffen = false
      socketEreignisse?.onClose(1006, 'network')
    })

    await act(async () => {
      await result.current.stop()
    })

    expect(textAenderungen.at(-1)).toContain('Erster Satz.')
    expect(textAenderungen.at(-1)).not.toContain('der Satz aus der Stoerung')

    // Das Netz kommt zurueck.
    await act(async () => {
      setzeNetz(true)
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(textAenderungen.at(-1)).toContain('der Satz aus der Stoerung')
    })
  })
})
