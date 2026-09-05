import { describe, it, expect, vi } from 'vitest'
import { AudioOutbox } from '@/lib/live-transcription/outbox'

/** Ein Block von 100 ms bei 24 kHz. */
function chunk(): Int16Array {
  return new Int16Array(2400)
}

describe('AudioOutbox', () => {
  it('ist zu Beginn leer', () => {
    const outbox = new AudioOutbox({ onOverflow: vi.fn() })
    expect(outbox.isEmpty).toBe(true)
    expect(outbox.bufferedSeconds).toBe(0)
  })

  it('zaehlt die gepufferte Dauer', () => {
    const outbox = new AudioOutbox({ onOverflow: vi.fn() })
    outbox.push(chunk())
    outbox.push(chunk())
    expect(outbox.bufferedSeconds).toBeCloseTo(0.2, 5)
  })

  it('gibt Bloecke in der Reihenfolge des Eingangs heraus', () => {
    const outbox = new AudioOutbox({ onOverflow: vi.fn() })
    const first = new Int16Array([1])
    const second = new Int16Array([2])
    outbox.push(first)
    outbox.push(second)

    const batch = outbox.take(1)
    expect(batch).toHaveLength(1)
    expect(batch[0]).toBe(first)
    expect(outbox.isEmpty).toBe(false)
  })

  it('meldet Ueberlauf, statt still zu verwerfen', () => {
    const onOverflow = vi.fn()
    // Ein halbes Sekunde Puffer: der fuenfte Block muss den ersten verdraengen.
    const outbox = new AudioOutbox({ maxSeconds: 0.4, onOverflow })

    for (let i = 0; i < 5; i += 1) outbox.push(chunk())

    expect(onOverflow).toHaveBeenCalled()
    const droppedMs = onOverflow.mock.calls[0][0] as number
    expect(droppedMs).toBeCloseTo(100, 0)
    expect(outbox.bufferedSeconds).toBeLessThanOrEqual(0.4)
  })

  it('leert sich vollstaendig', () => {
    const outbox = new AudioOutbox({ onOverflow: vi.fn() })
    outbox.push(chunk())
    outbox.clear()
    expect(outbox.isEmpty).toBe(true)
    expect(outbox.bufferedSeconds).toBe(0)
  })
})
