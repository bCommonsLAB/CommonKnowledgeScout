/**
 * Abstand der Animation `wolke` (Plan `teppich-der-dokumente` §3.6, Owner 23.11.2026:
 * „Bewegung bringt Schwarmoptik" — „komm in meine Naehe, aber nicht zu nahe").
 *
 * Eine eigene `d3-force`-Kraft fuer ALLE Punkte:
 * - Kein Punkt ueberlappt einen anderen: Unterschreiten zwei Punkte die Summe ihrer Radien
 *   (plus Luft), stossen sie sich auseinander.
 * - Aktive Punkte (die gewaehlten und ihre mitgezogenen Nachbarn) haben eine groessere Reichweite
 *   und schieben die uebrige Wolke beiseite; deren Zug heim bringt sie danach zurueck.
 *
 * Statt `forceCollide` (gemessen 14 ms je Schritt bei 2.184 Punkten) ein Raster, einmal je
 * Schritt gebaut; jeder Punkt prueft nur die Nachbarzellen.
 */

import type { Force, SimulationNodeDatum } from 'd3-force'
import { punktSaat } from '..'

interface Punkt extends SimulationNodeDatum { i: number }

/**
 * Anfangsstoss der Explosion: Alle liegen fast auf einem Punkt; jeder bekommt eine eigene, feste
 * Richtung und Wucht nach aussen. Danach formt das Netz die Wolke.
 */
export function explosionsStoss(knoten: Punkt[], wucht: number): void {
  for (const k of knoten) {
    const w = punktSaat(k.i) * 6.2832
    const v = wucht * (0.35 + 0.65 * punktSaat(k.i, 0.37))
    k.vx = Math.cos(w) * v
    k.vy = Math.sin(w) * v
  }
}

export interface AbstandsOptionen {
  /** Radius je Punkt (Pixel). */
  radius: (i: number) => number
  /** Aktive Punkte; sie schieben die uebrige Wolke mit `reichweite` beiseite. */
  aktiv: ReadonlySet<number>
  reichweite: (i: number) => number
  /** Luft zwischen zwei Punkten (Pixel). */
  luft?: number
}

export function abstandsKraft<N extends Punkt>(o: AbstandsOptionen): Force<N, undefined> {
  let knoten: N[] = []
  let zelle = 1
  const luft = o.luft ?? 1.5
  const kraft = ((alpha: number) => {
    const raster = new Map<number, N[]>()
    const schluessel = (cx: number, cy: number) => cx * 73856093 + cy * 19349663
    for (const n of knoten) {
      const k = schluessel(Math.floor((n.x ?? 0) / zelle), Math.floor((n.y ?? 0) / zelle))
      const liste = raster.get(k)
      if (liste) liste.push(n)
      else raster.set(k, [n])
    }
    const k = 0.5 * Math.max(alpha, 0.2)
    for (const a of knoten) {
      const aktivA = o.aktiv.has(a.i)
      const ra = o.radius(a.i)
      const weite = aktivA ? Math.ceil(o.reichweite(a.i) / zelle) : 1
      const cx = Math.floor((a.x ?? 0) / zelle)
      const cy = Math.floor((a.y ?? 0) / zelle)
      for (let ox = -weite; ox <= weite; ox++) {
        for (let oy = -weite; oy <= weite; oy++) {
          for (const b of raster.get(schluessel(cx + ox, cy + oy)) ?? []) {
            if (b === a) continue
            const aktivB = o.aktiv.has(b.i)
            // Jedes Paar einmal: zwischen gleichrangigen nur von der kleineren Kennung aus;
            // ein aktiver Punkt bearbeitet seine passiven Nachbarn allein.
            if (aktivA === aktivB ? b.i < a.i : !aktivA) continue
            const dx = (b.x ?? 0) - (a.x ?? 0)
            const dy = (b.y ?? 0) - (a.y ?? 0)
            const d = Math.hypot(dx, dy) || 0.01
            const min = aktivA && !aktivB ? Math.max(o.reichweite(a.i), ra + o.radius(b.i) + luft) : ra + o.radius(b.i) + luft
            if (d >= min) continue
            const ueber = ((min - d) / d) * k
            if (aktivA && !aktivB) {
              // Der aktive schiebt, der passive weicht ganz.
              b.vx = (b.vx ?? 0) + dx * ueber; b.vy = (b.vy ?? 0) + dy * ueber
            } else {
              b.vx = (b.vx ?? 0) + dx * ueber * 0.5; b.vy = (b.vy ?? 0) + dy * ueber * 0.5
              a.vx = (a.vx ?? 0) - dx * ueber * 0.5; a.vy = (a.vy ?? 0) - dy * ueber * 0.5
            }
          }
        }
      }
    }
  }) as Force<N, undefined>
  kraft.initialize = (alle: N[]) => {
    knoten = alle
    let rMax = 1
    for (const n of alle) rMax = Math.max(rMax, o.radius(n.i))
    zelle = 2 * rMax + luft
  }
  return kraft
}
