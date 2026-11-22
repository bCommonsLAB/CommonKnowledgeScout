// @vitest-environment node
/**
 * Teppich der Dokumente, Ablauf und Bewegung (Plan `teppich-der-dokumente`, T3).
 */
import { describe, it, expect } from 'vitest'
import type { ChatProcessingStep, DocReference } from '@ks/contracts'
import {
  SUCHE_MINDESTENS_MS, belegReihenfolge, botschaftsStufe, flugVerlauf, kandidatenAusSchritten, naechstePhase,
  schwarmKreise, schwarmSchritt, schwarmStart, storylineLage,
} from '@ks/module-website'

describe('Suchstufen (T4)', () => {
  it('liest die Auswahl aus dem letzten retrieval_complete; ohne Suche leer', () => {
    const schritte = [
      { type: 'retrieval_start', retriever: 'chunk' },
      { type: 'retrieval_complete', sourcesCount: 3, timingMs: 5, candidateFileIds: ['a', 'b'] },
      { type: 'llm_start', model: 'm' },
    ] as ChatProcessingStep[]
    expect(kandidatenAusSchritten(schritte)).toEqual(['a', 'b'])
    expect(kandidatenAusSchritten([{ type: 'cache_check_complete', found: true }] as ChatProcessingStep[])).toEqual([])
  })

  it('zieht die Kandidaten im Schwarm auf einen inneren Kreis, den Rest nach aussen', () => {
    const n = 400
    const x = Float32Array.from({ length: n }, (_, i) => (i % 20) * 40)
    const y = Float32Array.from({ length: n }, (_, i) => Math.floor(i / 20) * 20)
    const kandidaten = new Set(Array.from({ length: 30 }, (_, k) => k * 13))
    const kreis = schwarmKreise(n, kandidaten)
    expect(schwarmKreise(n, new Set())).toBeUndefined()
    const sw = schwarmStart(x, y)
    for (let s = 0; s < 600; s++) schwarmSchritt(sw, 1 / 60, s / 60, { x: 400, y: 200 }, 800, 400, kreis)
    const abstand = (i: number) => Math.hypot((sw.x[i] - 400) / 1.9, sw.y[i] - 200)
    const mittel = (ids: number[]) => ids.reduce((s, i) => s + abstand(i), 0) / ids.length
    const innen = [...kandidaten]
    const aussen = Array.from({ length: n }, (_, i) => i).filter((i) => !kandidaten.has(i))
    expect(mittel(innen)).toBeLessThan(mittel(aussen) * 0.7)
  })
})

describe('Botschaft der Animation', () => {
  it('folgt den Meldungen des Servers: suchen, gefunden, gewichten, schreiben', () => {
    const s = (type: string) => ({ type }) as ChatProcessingStep
    expect(botschaftsStufe([])).toBe(0)
    expect(botschaftsStufe([s('retrieval_start'), s('llm_start')])).toBe(0)
    expect(botschaftsStufe([s('retrieval_complete')])).toBe(1)
    expect(botschaftsStufe([s('retrieval_complete'), s('prompt_building')])).toBe(2)
    expect(botschaftsStufe([s('retrieval_complete'), s('prompt_building'), s('prompt_complete'), s('llm_progress')])).toBe(3)
  })
})

describe('Storyline (Ende der Animation)', () => {
  it('legt die Belege auf den innersten Kreis, innerhalb der Kandidaten', () => {
    const kreis = schwarmKreise(10, new Set([1, 2]), new Set([3]))!
    expect(kreis[3]).toBeLessThan(kreis[1])
    expect(kreis[1]).toBeLessThan(kreis[0])
    expect(schwarmKreise(10, new Set(), new Set([3]))).toBeDefined()
  })

  it('stellt die Belege untereinander in die Mitte der Flaeche, in der Hoehe begrenzt', () => {
    const { x, ys, zeile } = storylineLage(5, 800, 400)
    expect(ys).toHaveLength(5)
    expect((ys[0] + ys[4]) / 2).toBeCloseTo(200)
    for (let k = 1; k < 5; k++) expect(ys[k] - ys[k - 1]).toBeCloseTo(zeile)
    expect(x).toBeGreaterThan(24)
    expect(x).toBeLessThan(400)
    const viele = storylineLage(40, 800, 400)
    expect(viele.ys[39] - viele.ys[0]).toBeLessThanOrEqual(400)
  })
})

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
