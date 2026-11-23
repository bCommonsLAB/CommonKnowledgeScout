// @vitest-environment node
/**
 * Wolke des Teppichs (Plan `teppich-der-dokumente`, T5a): dieselbe Physik wie die Graph-Ansicht,
 * einmal auf dem Server; deterministisch, normiert, Dokumente ohne Nachbarn auf einem Ring.
 */
import { describe, it, expect } from 'vitest'
import { berechneWolke, WOLKE_SCHRITTE_FORTSETZUNG, WOLKE_SCHRITTE_NEU, type WolkenEingabe } from '@/lib/graph/teppich-wolke'

/** Zwei Gruppen zu je `n`, innen verbunden, dazu eine schwache Bruecke und ein Einzelgaenger. */
function zweiGruppen(n: number): WolkenEingabe[] {
  const id = (g: string, i: number) => `${g}${String(i).padStart(3, '0')}`
  const out: WolkenEingabe[] = []
  for (const g of ['a', 'b']) {
    for (let i = 0; i < n; i++) {
      out.push({ fileId: id(g, i), vorher: null, nachbarn: [1, 2, 3].map((d) => ({ fileId: id(g, (i + d) % n), weight: 0.8 })) })
    }
  }
  out[0].nachbarn.push({ fileId: id('b', 0), weight: 0.5 })
  out.push({ fileId: 'z-allein', vorher: null, nachbarn: [] })
  return out
}

const lageVon = (e: ReturnType<typeof berechneWolke>) => new Map(e.lagen.map((l) => [l.fileId, l]))
const abstand = (p: { wx: number; wy: number }, q: { wx: number; wy: number }) => Math.hypot(p.wx - q.wx, p.wy - q.wy)

describe('berechneWolke', () => {
  it('ist deterministisch, auch bei anderer Reihenfolge der Eingabe', () => {
    const e = zweiGruppen(30)
    const a = berechneWolke(e)
    const b = berechneWolke([...e].reverse())
    expect(b.lagen).toEqual(a.lagen)
    expect(a.schritte).toBe(WOLKE_SCHRITTE_NEU)
  })

  it('normiert auf 0..1, die laengere Achse spannt ganz auf', () => {
    const { lagen } = berechneWolke(zweiGruppen(30))
    for (const l of lagen) {
      expect(l.wx).toBeGreaterThanOrEqual(0); expect(l.wx).toBeLessThanOrEqual(1)
      expect(l.wy).toBeGreaterThanOrEqual(0); expect(l.wy).toBeLessThanOrEqual(1)
    }
    const spanneX = Math.max(...lagen.map((l) => l.wx)) - Math.min(...lagen.map((l) => l.wx))
    const spanneY = Math.max(...lagen.map((l) => l.wy)) - Math.min(...lagen.map((l) => l.wy))
    expect(Math.max(spanneX, spanneY)).toBeCloseTo(1, 5)
  })

  it('legt Verbundenes nah: eine Gruppe liegt enger beisammen als zwei Gruppen', () => {
    const w = lageVon(berechneWolke(zweiGruppen(30)))
    const mitte = (g: string) => {
      const ps = [...w.values()].filter((l) => l.fileId.startsWith(g))
      return { wx: ps.reduce((s, p) => s + p.wx, 0) / ps.length, wy: ps.reduce((s, p) => s + p.wy, 0) / ps.length }
    }
    const streuungA = [...w.values()].filter((l) => l.fileId.startsWith('a')).reduce((s, p) => s + abstand(p, mitte('a')), 0) / 30
    expect(abstand(mitte('a'), mitte('b'))).toBeGreaterThan(streuungA)
  })

  it('setzt Dokumente ohne Nachbarn auf einen Ring ausserhalb und zaehlt sie', () => {
    const e = berechneWolke(zweiGruppen(30))
    expect(e.ohneNachbarn).toBe(1)
    const w = lageVon(e)
    const z = w.get('z-allein')!
    // Gemessen von der Mitte der verbundenen Dokumente (der Ring macht den Rahmen schief).
    const verbunden = [...w.values()].filter((l) => l.fileId !== 'z-allein')
    const mitte = { wx: verbunden.reduce((s, p) => s + p.wx, 0) / verbunden.length, wy: verbunden.reduce((s, p) => s + p.wy, 0) / verbunden.length }
    // Ausserhalb von mindestens 90 % der Wolke — nicht hinter dem aeussersten Auslaeufer.
    const abstaende = verbunden.map((l) => abstand(l, mitte)).sort((p, q) => p - q)
    expect(abstand(z, mitte)).toBeGreaterThan(abstaende[Math.floor(0.9 * (abstaende.length - 1))])
  })

  it('setzt eine fruehere Wolke fort: weniger Schritte, Plaetze bleiben nah', () => {
    const e = zweiGruppen(30)
    const erste = lageVon(berechneWolke(e))
    const weiter = berechneWolke(e.map((x) => ({ ...x, vorher: { x: erste.get(x.fileId)!.wx, y: erste.get(x.fileId)!.wy } })))
    expect(weiter.schritte).toBe(WOLKE_SCHRITTE_FORTSETZUNG)
    const verschiebung = weiter.lagen.reduce((s, l) => s + abstand(l, erste.get(l.fileId)!), 0) / weiter.lagen.length
    expect(verschiebung).toBeLessThan(0.1)
  })

  it('rechnet 2.000 Dokumente in vertretbarer Zeit', () => {
    const n = 2000
    const e: WolkenEingabe[] = Array.from({ length: n }, (_, i) => ({
      fileId: `f${String(i).padStart(5, '0')}`, vorher: null,
      nachbarn: [1, 7, 31, 113].map((d) => ({ fileId: `f${String((i + d) % n).padStart(5, '0')}`, weight: 0.7 })),
    }))
    const t = Date.now()
    const w = berechneWolke(e)
    const ms = Date.now() - t
    console.info(`[teppich-wolke] ${n} Dokumente, ${w.kanten} Kanten: ${ms} ms`)
    expect(w.lagen).toHaveLength(n)
    expect(ms).toBeLessThan(20000)
  }, 30000)
})
