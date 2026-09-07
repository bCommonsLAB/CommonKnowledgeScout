// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Beweis-Ziel: Ein Abschnitt geht nicht verloren, nur weil beim Beenden das Netz fehlte.
 *
 * Hintergrund: Im Test am 07.09.2026 fiel auf, dass ein Stopp waehrend einer Stoerung den
 * Abschnitt endgueltig kostete — die Nacharbeit wurde einmal versucht, als 'gescheitert'
 * abgelegt und nie wiederholt, auch wenn die Verbindung zurueckkam.
 */

vi.mock('@/lib/live-transcription/media-recording', () => ({
  startGapRecording: vi.fn(() => ({ stop: async () => new Blob(['ton']) })),
  startContinuousRecording: vi.fn(() => ({ stop: async () => null })),
}))

const { GapController } = await import('@/lib/live-transcription/gap-controller')
const { TranscriptJournal } = await import('@/lib/live-transcription/transcript-journal')
const { AudioOutbox } = await import('@/lib/live-transcription/outbox')

function setzeNetz(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

interface Aufbau {
  controller: InstanceType<typeof GapController>
  journal: InstanceType<typeof TranscriptJournal>
  versuche: () => number
}

/** Baut eine Steuerung, deren Nacharbeit die ersten `fehlschlaege` Male scheitert. */
function aufbau(fehlschlaege: number): Aufbau {
  const journal = new TranscriptJournal()
  let versuche = 0
  const controller = new GapController({
    journal,
    stream: {} as MediaStream,
    outbox: new AudioOutbox({}),
    recoverGap: async () => {
      versuche += 1
      if (versuche <= fehlschlaege) throw new Error('Failed to fetch')
      return 'der nachgearbeitete Satz'
    },
    onChange: () => {},
    onRecoveryError: () => {},
  })
  return { controller, journal, versuche: () => versuche }
}

/** Oeffnet eine Stoerung und schliesst sie so, dass der Mitschnitt zustaendig ist. */
async function stoerungMitMitschnitt(controller: InstanceType<typeof GapController>): Promise<void> {
  controller.open(0, 'Netzausfall')
  controller.markOverflow()
  await controller.close(5000)
}

beforeEach(() => {
  setzeNetz(true)
})

afterEach(() => {
  setzeNetz(true)
  vi.restoreAllMocks()
})

describe('GapController — Nacharbeit und Netz', () => {
  it('schiebt die Nacharbeit auf, statt sie ohne Netz zu verwerfen', async () => {
    const { controller, journal } = aufbau(1)
    await stoerungMitMitschnitt(controller)

    setzeNetz(false)
    await controller.processPending()

    const luecke = journal.allGaps[0]
    expect(luecke.state).toBe('wartet')
    expect(luecke.state).not.toBe('gescheitert')
    expect(controller.hasUnfinishedWork).toBe(true)
  })

  it('nimmt die Nacharbeit wieder auf, sobald die Verbindung zurueck ist', async () => {
    const { controller, journal, versuche } = aufbau(1)
    await stoerungMitMitschnitt(controller)

    setzeNetz(false)
    await controller.processPending()
    expect(versuche()).toBe(1)

    setzeNetz(true)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(versuche()).toBe(2))

    await vi.waitFor(() => {
      expect(journal.allGaps[0].state).toBe('geschlossen')
    })
    expect(journal.toText()).toContain('der nachgearbeitete Satz')
  })

  it('meldet ein echtes Scheitern weiterhin als gescheitert', async () => {
    const { controller, journal } = aufbau(1)
    await stoerungMitMitschnitt(controller)

    // Netz vorhanden, der Dienst lehnt trotzdem ab: das ist kein Aufschub.
    await controller.processPending()

    expect(journal.allGaps[0].state).toBe('gescheitert')
  })
})
