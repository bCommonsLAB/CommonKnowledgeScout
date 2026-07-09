/**
 * Unit-Tests fuer computeEnablerLeverage (Plan summen-und-synergie-aggregation,
 * Stufe 4 — Grenzfaelle aus dem Konzept-Abschnitt "Methodik (Stufe 4)").
 */

import { describe, it, expect } from 'vitest'
import { computeEnablerLeverage } from '@/lib/graph/enabler-leverage'

const BETA = 0.5

describe('computeEnablerLeverage', () => {
  it('einzelner Enabler erbt beta * voller Wirkung des Ziels', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A', value: 0 }, { id: 'B', value: 100 }],
      [{ source: 'A', target: 'B', weight: 0.8 }],
      BETA,
    )
    // Einziger Enabler -> Anteil 1.0 unabhaengig vom Kantengewicht.
    expect(res.get('A')?.leverage).toBeCloseTo(0.5 * 100)
    expect(res.get('A')?.activated[0]).toMatchObject({ targetId: 'B', share: 1 })
    expect(res.has('B')).toBe(false) // B hat keine ausgehenden Kanten
  })

  it('mehrere Enabler teilen sich die Wirkung nach Gewichts-Anteil', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A1', value: 0 }, { id: 'A2', value: 0 }, { id: 'B', value: 100 }],
      [
        { source: 'A1', target: 'B', weight: 0.8 },
        { source: 'A2', target: 'B', weight: 0.2 },
      ],
      BETA,
    )
    expect(res.get('A1')?.leverage).toBeCloseTo(0.5 * 0.8 * 100)
    expect(res.get('A2')?.leverage).toBeCloseTo(0.5 * 0.2 * 100)
    // Anti-Doppelzaehlung: Summe der vererbten Wirkung <= beta * Wirkung_B.
    const total = (res.get('A1')?.leverage ?? 0) + (res.get('A2')?.leverage ?? 0)
    expect(total).toBeCloseTo(0.5 * 100)
  })

  it('beta=0 -> Hebel 0; beta ausserhalb [0..1] wirft', () => {
    const nodes = [{ id: 'A', value: 0 }, { id: 'B', value: 100 }]
    const edges = [{ source: 'A', target: 'B', weight: 1 }]
    expect(computeEnablerLeverage(nodes, edges, 0).get('A')?.leverage).toBe(0)
    expect(() => computeEnablerLeverage(nodes, edges, -0.1)).toThrow()
    expect(() => computeEnablerLeverage(nodes, edges, 1.1)).toThrow()
    expect(() => computeEnablerLeverage(nodes, edges, Number.NaN)).toThrow()
  })

  it('keine Kanten -> leeres Ergebnis (kein Eintrag statt stiller 0)', () => {
    const res = computeEnablerLeverage([{ id: 'A', value: 10 }], [], BETA)
    expect(res.size).toBe(0)
  })

  it('Selbstkanten, unbekannte Endpunkte und weight<=0 werden ignoriert', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A', value: 0 }, { id: 'B', value: 100 }],
      [
        { source: 'A', target: 'A', weight: 1 },
        { source: 'A', target: 'X', weight: 1 },
        { source: 'A', target: 'B', weight: 0 },
      ],
      BETA,
    )
    expect(res.size).toBe(0)
  })

  it('Zyklus A->B, B->A: je 1 Hop, keine Endlos-Vererbung', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A', value: 40 }, { id: 'B', value: 100 }],
      [
        { source: 'A', target: 'B', weight: 1 },
        { source: 'B', target: 'A', weight: 1 },
      ],
      BETA,
    )
    expect(res.get('A')?.leverage).toBeCloseTo(0.5 * 100)
    expect(res.get('B')?.leverage).toBeCloseTo(0.5 * 40)
  })

  it('Ziel ohne CO2-Wert: Beitrag 0, Aktivierung bleibt sichtbar', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A', value: 0 }, { id: 'B' }],
      [{ source: 'A', target: 'B', weight: 0.7 }],
      BETA,
    )
    expect(res.get('A')?.leverage).toBe(0)
    expect(res.get('A')?.activated).toHaveLength(1)
    expect(res.get('A')?.activated[0].contribution).toBe(0)
  })

  it('doppelte Kante derselben Richtung zaehlt nur einmal (max weight)', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A', value: 0 }, { id: 'B', value: 100 }],
      [
        { source: 'A', target: 'B', weight: 0.3 },
        { source: 'A', target: 'B', weight: 0.9 },
      ],
      BETA,
    )
    expect(res.get('A')?.activated).toHaveLength(1)
    expect(res.get('A')?.leverage).toBeCloseTo(0.5 * 100) // einziger Enabler -> Anteil 1
  })

  it('kein transitiver Hebel: A->B->C vererbt C nicht an A', () => {
    const res = computeEnablerLeverage(
      [{ id: 'A', value: 0 }, { id: 'B', value: 10 }, { id: 'C', value: 1000 }],
      [
        { source: 'A', target: 'B', weight: 1 },
        { source: 'B', target: 'C', weight: 1 },
      ],
      BETA,
    )
    expect(res.get('A')?.leverage).toBeCloseTo(0.5 * 10) // nur B, nicht C
    expect(res.get('B')?.leverage).toBeCloseTo(0.5 * 1000)
  })

  it('eigene Wirkung fliesst NIE in den Hebel ein (getrennte Kennzahlen)', () => {
    const small = computeEnablerLeverage(
      [{ id: 'A', value: 1 }, { id: 'B', value: 100 }],
      [{ source: 'A', target: 'B', weight: 1 }],
      BETA,
    )
    const big = computeEnablerLeverage(
      [{ id: 'A', value: 99999 }, { id: 'B', value: 100 }],
      [{ source: 'A', target: 'B', weight: 1 }],
      BETA,
    )
    expect(small.get('A')?.leverage).toBeCloseTo(big.get('A')?.leverage ?? -1)
  })
})
