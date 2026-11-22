// @vitest-environment node
/**
 * Teppich der Dokumente, Ablauf und Bewegung (Plan `teppich-der-dokumente`, T3).
 */
import { describe, it, expect } from 'vitest'
import type { DocReference } from '@ks/contracts'
import { SUCHE_MINDESTENS_MS, belegReihenfolge, flugVerlauf, naechstePhase, schwarmSchritt, schwarmStart } from '@ks/module-website'

describe('Belege in der Reihenfolge ihrer Dokumentnummer', () => {
  it('ordnet nach erster Zitatnummer, jedes Dokument einmal', () => {
    const ref = (number: number, fileId: string) => ({ number, fileId }) as DocReference
    expect(belegReihenfolge([ref(5, 'c'), ref(1, 'a'), ref(3, 'b'), ref(2, 'a')])).toEqual(['a', 'b', 'c'])
    expect(belegReihenfolge([])).toEqual([])
  })
})

const ruhig = { laeuft: false, fehler: false, hatAntwort: false }

describe('Teppich-Ablauf', () => {
  it('eine Frage schwaermt, solange sie laeuft', () => {
    expect(naechstePhase('ruhe', { ...ruhig, laeuft: true }, 0, false)).toBe('sucht')
    expect(naechstePhase('antwort', { ...ruhig, laeuft: true, hatAntwort: true }, 0, false)).toBe('sucht')
  })

  it('schwaermt mindestens die Mindestdauer, auch wenn die Antwort frueher da ist', () => {
    const fertig = { ...ruhig, hatAntwort: true }
    expect(naechstePhase('sucht', fertig, SUCHE_MINDESTENS_MS - 1, false)).toBe('sucht')
    expect(naechstePhase('sucht', fertig, SUCHE_MINDESTENS_MS, false)).toBe('landet')
  })

  it('landet, bis der Flug fertig ist, dann steht die Antwort', () => {
    const fertig = { ...ruhig, hatAntwort: true }
    expect(naechstePhase('landet', fertig, 9999, false)).toBe('landet')
    expect(naechstePhase('landet', fertig, 9999, true)).toBe('antwort')
  })

  it('scheitert die Frage oder hat sie keine Belege, endet der Schwarm in Ruhe', () => {
    expect(naechstePhase('sucht', { ...ruhig, fehler: true }, SUCHE_MINDESTENS_MS, false)).toBe('ruhe')
    expect(naechstePhase('sucht', ruhig, SUCHE_MINDESTENS_MS, false)).toBe('ruhe')
  })

  it('eine schon vorhandene Antwort steht ohne Flug; ohne Antwort zurueck in Ruhe', () => {
    expect(naechstePhase('ruhe', { ...ruhig, hatAntwort: true }, 0, false)).toBe('antwort')
    expect(naechstePhase('antwort', ruhig, 0, false)).toBe('ruhe')
  })
})

describe('Teppich-Schwarm', () => {
  it('bewegt alle Punkte und haelt sie in der Naehe der Flaeche', () => {
    const n = 500
    const x = Float32Array.from({ length: n }, (_, i) => (i % 25) * 32)
    const y = Float32Array.from({ length: n }, (_, i) => Math.floor(i / 25) * 20)
    const sw = schwarmStart(x, y)
    for (let s = 0; s < 400; s++) schwarmSchritt(sw, 1 / 60, s / 60, { x: 400, y: 200 }, 800, 400)
    let bewegt = 0
    for (let i = 0; i < n; i++) {
      if (Math.hypot(sw.x[i] - x[i], sw.y[i] - y[i]) > 5) bewegt++
      expect(Number.isFinite(sw.x[i]) && Number.isFinite(sw.y[i])).toBe(true)
      expect(sw.x[i]).toBeGreaterThan(-400)
      expect(sw.x[i]).toBeLessThan(1200)
      expect(sw.y[i]).toBeGreaterThan(-300)
      expect(sw.y[i]).toBeLessThan(700)
    }
    expect(bewegt).toBeGreaterThan(n * 0.9)
  })

  it('verlaeuft weich von 0 nach 1', () => {
    expect(flugVerlauf(0)).toBe(0)
    expect(flugVerlauf(1)).toBe(1)
    expect(flugVerlauf(0.5)).toBeCloseTo(0.5)
    expect(flugVerlauf(2)).toBe(1)
  })
})
