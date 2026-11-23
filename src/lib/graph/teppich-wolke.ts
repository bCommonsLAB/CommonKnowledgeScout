/**
 * @fileoverview Wolke des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T5a).
 *
 * @description
 * Reine Funktion ohne Datenbank: dieselbe Physik wie die Graph-Ansicht der Galerie
 * (`packages/module-explorer/.../use-graph-simulation.ts`: Kanten ziehen, alle stossen sich ab,
 * Punkte decken sich nicht), aber einmal auf dem Server statt bei jedem Aufruf im Browser. Das
 * Ergebnis ist der feste Platz jedes Dokuments in der Wolke.
 *
 * Deterministisch (Owner 23.11.2026, E11): Knoten und Kanten in fester Reihenfolge (nach
 * `fileId`), Startlage ohne Vorgaenger die Phyllotaxis-Spirale von d3, d3-eigener fester Zufall
 * (`randomSource` ist in d3-force 3 eine LCG mit festem Startwert), feste Schrittzahl. Gleiche
 * Eingabe ergibt dieselbe Wolke — auch, wenn der Browser sie spaeter nachrechnet (T5d).
 *
 * Liegt eine fruehere Wolke vor, startet die Rechnung dort und macht weniger Schritte; bestehende
 * Plaetze bleiben nah. Neue Dokumente starten in der Mitte ihrer Nachbarn.
 *
 * Gespeichert wird normiert: 0..1 auf der laengeren Achse, mittig, Seitenverhaeltnis erhalten.
 *
 * Kein stiller Rueckfall: Dokumente ohne Nachbarn liegen auf einem Ring ausserhalb der Wolke und
 * werden gezaehlt.
 *
 * @usedIn src/lib/graph/teppich-persist.ts
 */

import { forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3'

/** Kraefte wie in der Graph-Ansicht (`use-graph-simulation.ts`). */
const KANTE_ABSTAND = 90
const KANTE_STAERKE = 0.4
const ABSTOSSUNG = -180
const KOLLISION = 10
/** Schritte ohne bzw. mit frueherer Wolke (d3 kuehlt nach etwa 300 Schritten aus). */
export const WOLKE_SCHRITTE_NEU = 300
export const WOLKE_SCHRITTE_FORTSETZUNG = 80
/**
 * Ring der Dokumente ohne Nachbarn: Vielfaches des Abstands, innerhalb dessen `RING_ANTEIL` der
 * Wolke liegt. Nicht der groesste Abstand — ein einzelner Auslaeufer machte den Ring sonst so
 * gross, dass die Wolke nur die Haelfte der Flaeche fuellt (FOSDEM, 23.11.2026).
 */
const RING = 1.05
const RING_ANTEIL = 0.9

export interface WolkenEingabe {
  fileId: string
  nachbarn: Array<{ fileId: string; weight: number }>
  /** Fruehere Wolke (normiert 0..1); `null` ohne. */
  vorher: { x: number; y: number } | null
}

export interface WolkenLage {
  fileId: string
  wx: number
  wy: number
}

export interface WolkenErgebnis {
  lagen: WolkenLage[]
  ohneNachbarn: number
  kanten: number
  schritte: number
}

interface Knoten extends SimulationNodeDatum { id: string }

/** Ungerichtete Kanten, jede einmal, nur zwischen bekannten Dokumenten. */
function kantenAus(eingaben: readonly WolkenEingabe[], bekannt: ReadonlySet<string>): Array<[string, string]> {
  const paare = new Set<string>()
  for (const e of eingaben) {
    for (const n of e.nachbarn) {
      if (n.fileId === e.fileId || !bekannt.has(n.fileId)) continue
      paare.add(e.fileId < n.fileId ? `${e.fileId}\u0000${n.fileId}` : `${n.fileId}\u0000${e.fileId}`)
    }
  }
  return [...paare].sort().map((p) => p.split('\u0000') as [string, string])
}

/** Spanne der Rechnung fuer eine normierte fruehere Lage (Groessenordnung der d3-Ausdehnung). */
const spanne = (n: number): number => 40 * Math.sqrt(n)

export function berechneWolke(eingabenRoh: readonly WolkenEingabe[]): WolkenErgebnis {
  const eingaben = [...eingabenRoh].sort((a, b) => (a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0))
  const bekannt = new Set(eingaben.map((e) => e.fileId))
  const kanten = kantenAus(eingaben, bekannt)
  const verbunden = new Set(kanten.flat())
  const imGraph = eingaben.filter((e) => verbunden.has(e.fileId))
  const allein = eingaben.filter((e) => !verbunden.has(e.fileId))

  // Startlage: fruehere Wolke, sonst Mitte der Nachbarn mit frueherer Lage, sonst d3 (Spirale).
  const s = spanne(imGraph.length)
  const vorher = new Map(imGraph.filter((e) => e.vorher).map((e) => [e.fileId, e.vorher as { x: number; y: number }]))
  const fortsetzung = vorher.size * 2 >= imGraph.length && imGraph.length > 0
  const knoten: Knoten[] = imGraph.map((e) => {
    if (!fortsetzung) return { id: e.fileId }
    const v = vorher.get(e.fileId)
    if (v) return { id: e.fileId, x: (v.x - 0.5) * s, y: (v.y - 0.5) * s }
    const nah = e.nachbarn.map((n) => vorher.get(n.fileId)).filter((p): p is { x: number; y: number } => !!p)
    if (nah.length === 0) return { id: e.fileId }
    const mx = nah.reduce((a, p) => a + p.x, 0) / nah.length
    const my = nah.reduce((a, p) => a + p.y, 0) / nah.length
    return { id: e.fileId, x: (mx - 0.5) * s, y: (my - 0.5) * s }
  })

  const schritte = fortsetzung ? WOLKE_SCHRITTE_FORTSETZUNG : WOLKE_SCHRITTE_NEU
  if (knoten.length > 0) {
    const links: Array<SimulationLinkDatum<Knoten>> = kanten.map(([a, b]) => ({ source: a, target: b }))
    const sim = forceSimulation<Knoten>(knoten)
      .force('link', forceLink<Knoten, SimulationLinkDatum<Knoten>>(links).id((d) => d.id).distance(KANTE_ABSTAND).strength(KANTE_STAERKE))
      .force('charge', forceManyBody<Knoten>().strength(ABSTOSSUNG))
      .force('collide', forceCollide<Knoten>(KOLLISION).iterations(2))
      .stop()
    if (fortsetzung) sim.alpha(0.3)
    sim.tick(schritte)
  }

  // Mitte der Wolke, dann der Ring fuer die Dokumente ohne Nachbarn.
  const n = Math.max(1, knoten.length)
  const cx = knoten.reduce((a, k) => a + (k.x ?? 0), 0) / n
  const cy = knoten.reduce((a, k) => a + (k.y ?? 0), 0) / n
  const abstaende = knoten.map((k) => Math.hypot((k.x ?? 0) - cx, (k.y ?? 0) - cy)).sort((p, q) => p - q)
  const rRing = (abstaende[Math.floor(RING_ANTEIL * (abstaende.length - 1))] || KANTE_ABSTAND) * RING
  const roh: Array<{ fileId: string; x: number; y: number }> = knoten.map((k) => ({ fileId: k.id, x: (k.x ?? 0) - cx, y: (k.y ?? 0) - cy }))
  allein.forEach((e, i) => {
    const w = (i / allein.length) * 2 * Math.PI
    roh.push({ fileId: e.fileId, x: Math.cos(w) * rRing, y: Math.sin(w) * rRing })
  })

  // Normieren: laengere Achse 0..1, mittig, Seitenverhaeltnis erhalten.
  const minX = Math.min(...roh.map((p) => p.x))
  const maxX = Math.max(...roh.map((p) => p.x))
  const minY = Math.min(...roh.map((p) => p.y))
  const maxY = Math.max(...roh.map((p) => p.y))
  const seite = Math.max(maxX - minX, maxY - minY) || 1
  const lagen = roh.map((p) => ({
    fileId: p.fileId,
    wx: 0.5 + (p.x - (minX + maxX) / 2) / seite,
    wy: 0.5 + (p.y - (minY + maxY) / 2) / seite,
  }))
  return { lagen, ohneNachbarn: allein.length, kanten: kanten.length, schritte }
}
