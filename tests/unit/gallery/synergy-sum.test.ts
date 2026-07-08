/**
 * Unit-Tests fuer computeSynergyAdjustedSum (Plan summen-und-synergie-
 * aggregation, Todo synergy-lib). Deckt die im Plan geforderten Grenzfaelle
 * ab: s=1 & gleiche Werte zaehlen ~1x, s=0/keine Kanten/alpha=0 -> naive
 * Summe, fehlende Werte werden ausgelassen und gezaehlt.
 */

import { describe, it, expect } from 'vitest'
import { computeSynergyAdjustedSum } from '@/lib/graph/synergy-sum'

describe('computeSynergyAdjustedSum', () => {
  it('zaehlt zwei identische Massnahmen (s=1, alpha=1) ~einmal', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 100 },
        { id: 'b', value: 100 },
      ],
      [{ source: 'a', target: 'b', weight: 1 }],
      1,
    )
    expect(result.naiveSum).toBe(200)
    // Erste zaehlt voll, zweite mit Faktor (1 - 1*1) = 0.
    expect(result.adjustedSum).toBe(100)
    expect(result.counted).toBe(2)
    expect(result.missing).toBe(0)
  })

  it('liefert die naive Summe bei Kanten mit Gewicht 0', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 50 },
        { id: 'b', value: 30 },
      ],
      [{ source: 'a', target: 'b', weight: 0 }],
      0.9,
    )
    expect(result.adjustedSum).toBe(result.naiveSum)
    expect(result.naiveSum).toBe(80)
  })

  it('liefert die naive Summe ohne Kanten', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 50 },
        { id: 'b', value: 30 },
        { id: 'c', value: 20 },
      ],
      [],
      0.9,
    )
    expect(result.adjustedSum).toBe(100)
    expect(result.naiveSum).toBe(100)
  })

  it('liefert die naive Summe bei alpha=0', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 50 },
        { id: 'b', value: 30 },
      ],
      [{ source: 'a', target: 'b', weight: 0.8 }],
      0,
    )
    expect(result.adjustedSum).toBe(result.naiveSum)
  })

  it('laesst fehlende Werte aus und meldet sie als missing (nie als 0 summieren)', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 100 },
        { id: 'b', value: null },
        { id: 'c', value: undefined },
        { id: 'd', value: Number.NaN },
      ],
      [],
      0.5,
    )
    expect(result.naiveSum).toBe(100)
    expect(result.adjustedSum).toBe(100)
    expect(result.counted).toBe(1)
    expect(result.missing).toBe(3)
  })

  it('zinst nur gegen BEREITS gezaehlte Nachbarn ab (Greedy-Reihenfolge)', () => {
    // b (80) haengt an a (100): a zaehlt voll, b mit (1 - 0.5*0.6) = 0.7.
    // c (60) haengt an b: c wird gegen b abgezinst, nicht gegen a.
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 100 },
        { id: 'b', value: 80 },
        { id: 'c', value: 60 },
      ],
      [
        { source: 'a', target: 'b', weight: 0.6 },
        { source: 'b', target: 'c', weight: 0.5 },
      ],
      0.5,
    )
    expect(result.naiveSum).toBe(240)
    const expected = 100 + 80 * (1 - 0.5 * 0.6) + 60 * (1 - 0.5 * 0.5)
    expect(result.adjustedSum).toBeCloseTo(expected, 10)
    // Abzinsung darf die Summe nie erhoehen.
    expect(result.adjustedSum).toBeLessThanOrEqual(result.naiveSum)
  })

  it('dedupliziert doppelte Kanten (staerkstes Gewicht) und ignoriert Selbstkanten', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 100 },
        { id: 'b', value: 100 },
      ],
      [
        { source: 'a', target: 'a', weight: 1 },
        { source: 'a', target: 'b', weight: 0.2 },
        { source: 'b', target: 'a', weight: 0.8 },
      ],
      1,
    )
    // Staerkste Kante (0.8) gilt: 100 + 100*(1-0.8) = 120.
    expect(result.adjustedSum).toBeCloseTo(120, 10)
  })

  it('begrenzt Kantengewichte > 1 auf 1 (kein negativer Beitrag)', () => {
    const result = computeSynergyAdjustedSum(
      [
        { id: 'a', value: 100 },
        { id: 'b', value: 100 },
      ],
      [{ source: 'a', target: 'b', weight: 1.7 }],
      1,
    )
    expect(result.adjustedSum).toBe(100)
    expect(result.adjustedSum).toBeGreaterThanOrEqual(0)
  })

  it('wirft bei alpha ausserhalb [0..1] (kein Silent-Clamp)', () => {
    const items = [{ id: 'a', value: 1 }]
    expect(() => computeSynergyAdjustedSum(items, [], -0.1)).toThrow()
    expect(() => computeSynergyAdjustedSum(items, [], 1.1)).toThrow()
    expect(() => computeSynergyAdjustedSum(items, [], Number.NaN)).toThrow()
  })

  it('ist deterministisch bei Wert-Gleichstand (stabile id-Sortierung)', () => {
    const edges = [{ source: 'x', target: 'y', weight: 0.5 }]
    const a = computeSynergyAdjustedSum(
      [
        { id: 'y', value: 10 },
        { id: 'x', value: 10 },
      ],
      edges,
      0.8,
    )
    const b = computeSynergyAdjustedSum(
      [
        { id: 'x', value: 10 },
        { id: 'y', value: 10 },
      ],
      edges,
      0.8,
    )
    expect(a.adjustedSum).toBe(b.adjustedSum)
  })
})
