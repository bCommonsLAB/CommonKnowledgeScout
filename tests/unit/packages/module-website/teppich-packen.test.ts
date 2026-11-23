// @vitest-environment node
/**
 * Teppich der Dokumente, Plaetze in der Wolke (Plan `teppich-der-dokumente`, T5b):
 * die Wolke des Servers (`wx`, `wy`) eingepasst in den Kasten, ein Massstab, mittig.
 */
import { describe, it, expect } from 'vitest'
import { hatWolke, naechsterTeppichPunkt, packeWolke, teppichRadius, type TeppichPunkt } from '@ks/module-website'

const punkt = (i: number, wx: number | null, wy: number | null): TeppichPunkt =>
  ({ fileId: `f${i}`, x: 0, y: 0, wx, wy, nachbarn: [], gewicht: null, jahr: null, titel: `T${i}` })

const FLAECHE = { breite: 800, hoehe: 400, rand: 20 }

describe('Teppich: Wolke einpassen', () => {
  it('leer bleibt leer', () => {
    expect(packeWolke([], FLAECHE)).toMatchObject({ zelle: 0 })
  })

  it('ein Massstab fuer beide Achsen: die Wolke fuellt die Hoehe, mittig in der Breite', () => {
    // Quadratische Wolke 0..1 in einem breiten Kasten.
    const punkte = [punkt(0, 0, 0), punkt(1, 1, 0), punkt(2, 0, 1), punkt(3, 1, 1)]
    const r = packeWolke(punkte, FLAECHE)
    expect(r.py[0]).toBeCloseTo(20); expect(r.py[2]).toBeCloseTo(380)
    expect(r.px[1] - r.px[0]).toBeCloseTo(360)
    expect((r.px[0] + r.px[1]) / 2).toBeCloseTo(400)
  })

  it('verschiebt um den versatz (Leinwand breiter als der Kasten)', () => {
    const punkte = [punkt(0, 0.2, 0.5), punkt(1, 0.8, 0.5)]
    const ohne = packeWolke(punkte, FLAECHE)
    const mit = packeWolke(punkte, { ...FLAECHE, versatz: 100 })
    expect(mit.px[0]).toBeCloseTo(ohne.px[0] + 100)
    expect(mit.py[0]).toBeCloseTo(ohne.py[0])
  })

  it('bleibt innerhalb des Kastens abzueglich des Rands', () => {
    const punkte = Array.from({ length: 500 }, (_, i) => punkt(i, ((i * 37) % 500) / 500, ((i * 7919) % 500) / 500))
    const r = packeWolke(punkte, FLAECHE)
    for (let i = 0; i < punkte.length; i++) {
      expect(r.px[i]).toBeGreaterThanOrEqual(FLAECHE.rand - 0.01)
      expect(r.px[i]).toBeLessThanOrEqual(FLAECHE.breite - FLAECHE.rand + 0.01)
      expect(r.py[i]).toBeGreaterThanOrEqual(FLAECHE.rand - 0.01)
      expect(r.py[i]).toBeLessThanOrEqual(FLAECHE.hoehe - FLAECHE.rand + 0.01)
    }
    expect(r.zelle).toBeGreaterThan(0)
  })

  it('ohne Wolke: hatWolke falsch, packeWolke wirft statt still zu raten', () => {
    const punkte = [punkt(0, 0.5, 0.5), punkt(1, null, null)]
    expect(hatWolke(punkte)).toBe(false)
    expect(hatWolke([punkt(0, 0.5, 0.5)])).toBe(true)
    expect(() => packeWolke(punkte, FLAECHE)).toThrow(/teppich_berechnen/)
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
