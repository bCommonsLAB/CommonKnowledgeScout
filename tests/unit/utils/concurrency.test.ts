import { describe, it, expect } from 'vitest'
import { mapWithConcurrency } from '@/lib/utils/concurrency'

describe('mapWithConcurrency', () => {
  it('liefert Ergebnisse in Original-Reihenfolge (auch bei ungleichen Laufzeiten)', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      // spaetere Items absichtlich schneller -> Reihenfolge muss trotzdem stimmen
      await new Promise((r) => setTimeout(r, (6 - n) * 2))
      return n * 10
    })
    expect(out).toEqual([10, 20, 30, 40, 50])
  })

  it('haelt die maximale Parallelitaet ein und arbeitet wirklich parallel', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 20 }, (_, i) => i)
    await mapWithConcurrency(items, 4, async (i) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return i
    })
    expect(maxActive).toBeLessThanOrEqual(4)
    expect(maxActive).toBeGreaterThan(1)
  })

  it('liefert [] fuer leere Eingabe und ruft fn nicht auf', async () => {
    let calls = 0
    const out = await mapWithConcurrency([], 4, async () => {
      calls++
      return 1
    })
    expect(out).toEqual([])
    expect(calls).toBe(0)
  })

  it('behandelt limit > items.length korrekt', async () => {
    const out = await mapWithConcurrency([1, 2], 10, async (n) => n + 1)
    expect(out).toEqual([2, 3])
  })
})
