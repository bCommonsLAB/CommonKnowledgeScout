import { describe, expect, it } from 'vitest'
import {
  computeRatingRaw,
  computeRatingPercentile,
  assignRatingPercentiles,
} from '@/lib/gallery/rating'

describe('computeRatingRaw', () => {
  it('berechnet impact * feasibility / cost bei vollstaendigen Daten', () => {
    const res = computeRatingRaw({ impact: 10, feasibility: 0.5, cost: 2 })
    expect(res).toEqual({ status: 'ok', raw: 2.5 })
  })

  it('liefert "unknown-cost" wenn Kosten fehlen', () => {
    expect(computeRatingRaw({ impact: 10, feasibility: 0.5 })).toEqual({
      status: 'unknown-cost',
    })
  })

  it('liefert "unknown-cost" wenn Kosten 0 sind (kein Epsilon-Trick)', () => {
    expect(computeRatingRaw({ impact: 10, feasibility: 0.5, cost: 0 })).toEqual({
      status: 'unknown-cost',
    })
  })

  it('liefert "unknown-cost" wenn Kosten negativ sind', () => {
    expect(computeRatingRaw({ impact: 10, feasibility: 0.5, cost: -5 })).toEqual({
      status: 'unknown-cost',
    })
  })

  it('liefert "insufficient" wenn impact fehlt', () => {
    expect(computeRatingRaw({ feasibility: 0.5, cost: 2 })).toEqual({
      status: 'insufficient',
    })
  })

  it('liefert "insufficient" wenn feasibility fehlt', () => {
    expect(computeRatingRaw({ impact: 10, cost: 2 })).toEqual({
      status: 'insufficient',
    })
  })

  it('behandelt NaN/Infinity als fehlend', () => {
    expect(computeRatingRaw({ impact: NaN, feasibility: 0.5, cost: 2 })).toEqual({
      status: 'insufficient',
    })
    expect(
      computeRatingRaw({ impact: 10, feasibility: 0.5, cost: Infinity }),
    ).toEqual({ status: 'unknown-cost' })
  })

  it('erlaubt impact = 0 (Enabler bleiben sichtbar, ranken niedrig)', () => {
    expect(computeRatingRaw({ impact: 0, feasibility: 0.8, cost: 100 })).toEqual({
      status: 'ok',
      raw: 0,
    })
  })
})

describe('computeRatingPercentile', () => {
  it('liefert undefined bei leerer Verteilung', () => {
    expect(computeRatingPercentile(5, [])).toBeUndefined()
  })

  it('liefert 100 bei nur einem Wert', () => {
    expect(computeRatingPercentile(5, [5])).toBe(100)
  })

  it('ordnet den groessten Wert auf 100 und den kleinsten auf 0', () => {
    const values = [1, 2, 3, 4, 5]
    expect(computeRatingPercentile(5, values)).toBe(100)
    expect(computeRatingPercentile(1, values)).toBe(0)
  })

  it('berechnet Zwischen-Perzentile relativ zur Verteilung', () => {
    const values = [0, 10, 20, 30, 40]
    // 2 von 4 anderen Werten liegen unter 20 -> 50 %
    expect(computeRatingPercentile(20, values)).toBe(50)
  })

  it('gibt gleichen Werten denselben Perzentil', () => {
    const values = [10, 10, 20]
    expect(computeRatingPercentile(10, values)).toBe(0)
    expect(computeRatingPercentile(20, values)).toBe(100)
  })
})

describe('assignRatingPercentiles', () => {
  it('vergibt Perzentile nur fuer gueltige Roh-Werte', () => {
    const result = assignRatingPercentiles([10, undefined, 30, null, 20])
    expect(result[0]).toBe(0) // 10 = kleinster
    expect(result[1]).toBeUndefined() // unknown-cost
    expect(result[2]).toBe(100) // 30 = groesster
    expect(result[3]).toBeUndefined() // unknown-cost
    expect(result[4]).toBe(50) // 20 = mittig
  })

  it('schliesst ungueltige Werte aus der Verteilung aus', () => {
    // Nur ein gueltiger Wert -> dieser bekommt 100, der Rest undefined
    const result = assignRatingPercentiles([undefined, 42, null])
    expect(result).toEqual([undefined, 100, undefined])
  })

  it('liefert leeres Resultat fuer leere Eingabe', () => {
    expect(assignRatingPercentiles([])).toEqual([])
  })
})
