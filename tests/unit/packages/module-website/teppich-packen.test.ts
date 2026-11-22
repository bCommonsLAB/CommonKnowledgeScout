// @vitest-environment node
/**
 * Teppich der Dokumente, Packen auf die Flaeche (Plan `teppich-der-dokumente`, T2):
 * Zeit nach rechts, Aehnlichkeit von oben nach unten, alles innerhalb des Rands.
 */
import { describe, it, expect } from 'vitest'
import { naechsterTeppichPunkt, packeTeppich, teppichRadius, type TeppichPunkt } from '@ks/module-website'

const punkt = (i: number, p: Partial<TeppichPunkt> = {}): TeppichPunkt =>
  ({ fileId: `f${String(i).padStart(4, '0')}`, x: i / 100, y: 0.5, gewicht: null, jahr: null, titel: `T${i}`, ...p })

const FLAECHE = { breite: 800, hoehe: 400, rand: 20 }

describe('Teppich packen', () => {
  it('leer bleibt leer', () => {
    expect(packeTeppich([], FLAECHE)).toMatchObject({ zelle: 0, spalten: 0, jahrMarken: [] })
  })

  it('legt spaetere Dokumente weiter rechts, nie links von frueheren', () => {
    const punkte = Array.from({ length: 100 }, (_, i) => punkt(i, { y: (i * 37) % 100 / 100 }))
    const r = packeTeppich(punkte, FLAECHE)
    for (let i = 1; i < 100; i++) expect(r.px[i]).toBeGreaterThanOrEqual(r.px[i - 1])
    expect(r.spalten).toBeGreaterThan(1)
  })

  it('ordnet innerhalb einer Spalte nach Aehnlichkeit von oben nach unten', () => {
    const punkte = [punkt(0, { x: 0.1, y: 0.9 }), punkt(1, { x: 0.1, y: 0.1 }), punkt(2, { x: 0.1, y: 0.5 })]
    const r = packeTeppich(punkte, { breite: 40, hoehe: 400, rand: 0 })
    expect(r.spalten).toBe(1)
    expect(r.py[1]).toBeLessThan(r.py[2])
    expect(r.py[2]).toBeLessThan(r.py[0])
  })

  it('bleibt innerhalb der Flaeche abzueglich des Rands', () => {
    const punkte = Array.from({ length: 5000 }, (_, i) => punkt(i, { x: i / 5000, y: ((i * 7919) % 5000) / 5000 }))
    const r = packeTeppich(punkte, FLAECHE)
    for (let i = 0; i < punkte.length; i++) {
      expect(r.px[i]).toBeGreaterThanOrEqual(FLAECHE.rand - 0.01)
      expect(r.px[i]).toBeLessThanOrEqual(FLAECHE.breite - FLAECHE.rand + 0.01)
      expect(r.py[i]).toBeGreaterThanOrEqual(FLAECHE.rand - r.zelle)
      expect(r.py[i]).toBeLessThanOrEqual(FLAECHE.hoehe - FLAECHE.rand + r.zelle)
    }
  })

  it('setzt Jahreszahlen dort, wo ein neues Jahr beginnt, mit Mindestabstand', () => {
    const punkte = Array.from({ length: 200 }, (_, i) => punkt(i, { x: i / 200, jahr: 2020 + Math.floor(i / 50) }))
    const r = packeTeppich(punkte, FLAECHE)
    expect(r.jahrMarken.map((m) => m.jahr)).toEqual([2020, 2021, 2022, 2023])
    for (let i = 1; i < r.jahrMarken.length; i++) expect(r.jahrMarken[i].x - r.jahrMarken[i - 1].x).toBeGreaterThanOrEqual(44)
  })
})

describe('Teppich: Radius und Treffer', () => {
  it('waechst mit dem Gewicht, ohne Gewicht der kleinste', () => {
    expect(teppichRadius(10, 1)).toBeGreaterThan(teppichRadius(10, 0.5))
    expect(teppichRadius(10, null)).toBe(teppichRadius(10, 0))
  })

  it('fuellt bei grossen Zellen gut die Haelfte, aber nie mehr als die Zelle', () => {
    expect(teppichRadius(48, null)).toBeGreaterThanOrEqual(4)
    expect(teppichRadius(48, 1) * 2).toBeLessThanOrEqual(48)
    expect(teppichRadius(4, null)).toBeGreaterThanOrEqual(0.8)
  })

  it('findet den naechsten Punkt nur innerhalb des Abstands', () => {
    const px = new Float32Array([10, 50, 90])
    const py = new Float32Array([10, 10, 10])
    expect(naechsterTeppichPunkt(px, py, 48, 12, 8)).toBe(1)
    expect(naechsterTeppichPunkt(px, py, 30, 40, 8)).toBe(-1)
  })
})
