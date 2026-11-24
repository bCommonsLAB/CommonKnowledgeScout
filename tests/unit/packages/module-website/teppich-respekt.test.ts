/**
 * Respektabstand um die Belege in der Graph-Ansicht (Owner 24.11.2026): Um jeden Beleg ist ein
 * Kreis frei, Belege halten zueinander mehr Abstand, und sie haben Vorrang beim Treffen.
 */
import { describe, it, expect } from 'vitest'
import { haltAbstand, hervorTreffer, type TeppichPlaetze } from '@ks/module-website'

function plaetze(punkte: Array<[number, number]>): TeppichPlaetze {
  return { px: Float32Array.from(punkte, (p) => p[0]), py: Float32Array.from(punkte, (p) => p[1]), zelle: 10 }
}
const abstand = (p: TeppichPlaetze, i: number, j: number) => Math.hypot(p.px[i] - p.px[j], p.py[i] - p.py[j])

describe('haltAbstand', () => {
  it('ohne Hervorgehobene bleiben die Plaetze dieselben', () => {
    const p = plaetze([[0, 0], [5, 0]])
    expect(haltAbstand(p, [], 20)).toBe(p)
  })

  it('Punkte im Umkreis weichen an dessen Rand, in ihrer Richtung; ferne bleiben', () => {
    const p = haltAbstand(plaetze([[100, 100], [104, 100], [100, 97], [160, 100]]), [0], 20)
    expect(abstand(p, 0, 1)).toBeCloseTo(20, 3)
    expect(p.px[1]).toBeGreaterThan(100)
    expect(abstand(p, 0, 2)).toBeCloseTo(20, 3)
    expect(p.py[2]).toBeLessThan(100)
    expect([p.px[3], p.py[3]]).toEqual([160, 100])
    expect([p.px[0], p.py[0]]).toEqual([100, 100])
  })

  it('Belege ruecken auseinander (anderthalbfacher Abstand), auch wenn sie aufeinander liegen', () => {
    const p = haltAbstand(plaetze([[100, 100], [103, 100], [50, 50], [50, 50]]), [0, 1, 2, 3], 20)
    expect(abstand(p, 0, 1)).toBeGreaterThanOrEqual(30 - 0.01)
    expect(abstand(p, 2, 3)).toBeGreaterThanOrEqual(30 - 0.01)
    expect(Number.isFinite(p.px[2]) && Number.isFinite(p.py[3])).toBe(true)
  })

  it('ein Punkt genau auf dem Beleg bekommt eine feste Richtung', () => {
    const a = haltAbstand(plaetze([[10, 10], [10, 10]]), [0], 8)
    const b = haltAbstand(plaetze([[10, 10], [10, 10]]), [0], 8)
    expect(abstand(a, 0, 1)).toBeCloseTo(8, 3)
    expect([a.px[1], a.py[1]]).toEqual([b.px[1], b.py[1]])
  })
})

describe('hervorTreffer', () => {
  it('nimmt den naechsten Beleg in seiner Weite, sonst -1', () => {
    const x = [0, 30, 60], y = [0, 0, 0]
    expect(hervorTreffer(x, y, [1, 2], 34, 0, () => 10)).toBe(1)
    expect(hervorTreffer(x, y, [1, 2], 46, 0, () => 20)).toBe(2)
    expect(hervorTreffer(x, y, [1, 2], 0, 0, () => 10)).toBe(-1)
  })
})
