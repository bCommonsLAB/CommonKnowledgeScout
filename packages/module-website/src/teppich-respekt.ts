/**
 * @fileoverview Respektabstand um hervorgehobene Punkte der Wolke.
 *
 * @description
 * Owner 24.11.2026: In der Graph-Ansicht liegen die Belege der Antwort in ihrem Umfeld — in der
 * dichten Wolke ueberlagert, kaum zu sehen und kaum zu treffen. Die Belege werden groesser
 * gezeichnet (als Marke, `BELEG_RADIUS`) und halten Abstand: zueinander, und die uebrigen Punkte weichen aus
 * ihrem Umkreis an dessen Rand. Die Nachbarschaft bleibt lesbar (wer nah war, bleibt nah), nur der
 * Kreis um den Beleg ist frei. Reine Funktionen ohne React.
 *
 * @module website
 */

import type { TeppichPlaetze } from './teppich-packen'

/** Radius der Belegmarke in der Wolke (Pixel): 20 px Durchmesser wie die Zitatmarke im Text der Antwort. */
export const BELEG_RADIUS = 10
/** Belege halten zueinander das Anderthalbfache des Abstands, den die uebrigen Punkte halten. */
const UNTEREINANDER = 1.5
const RUNDEN = 12

/** Feste Richtung fuer Punkte, die genau aufeinander liegen (kein Zufall: gleiche Eingabe, gleiches Bild). */
function richtung(i: number): [number, number] {
  const w = i * 2.399963
  return [Math.cos(w), Math.sin(w)]
}

/**
 * Schiebt die Punkte so, dass um jeden hervorgehobenen ein Kreis mit Radius `abstand` frei ist.
 * `hervor`: Indizes der hervorgehobenen Punkte. Ohne solche (oder `abstand <= 0`) dieselben Plaetze.
 */
export function haltAbstand(plaetze: TeppichPlaetze, hervor: readonly number[], abstand: number): TeppichPlaetze {
  const n = plaetze.px.length
  const gueltig = hervor.filter((i) => i >= 0 && i < n)
  if (gueltig.length === 0 || abstand <= 0) return plaetze
  const px = Float32Array.from(plaetze.px)
  const py = Float32Array.from(plaetze.py)
  // 1. Die Hervorgehobenen ruecken auseinander, je zur Haelfte.
  const weit = abstand * UNTEREINANDER
  for (let r = 0; r < RUNDEN; r++) {
    let bewegt = false
    for (let a = 0; a < gueltig.length; a++) {
      for (let b = a + 1; b < gueltig.length; b++) {
        const i = gueltig[a], j = gueltig[b]
        let dx = px[j] - px[i], dy = py[j] - py[i]
        let d = Math.hypot(dx, dy)
        if (d >= weit) continue
        if (d < 1e-3) { [dx, dy] = richtung(a * 31 + b); d = 1 }
        const s = (weit - d) / 2 / d
        px[i] -= dx * s; py[i] -= dy * s
        px[j] += dx * s; py[j] += dy * s
        bewegt = true
      }
    }
    if (!bewegt) break
  }
  // 2. Alle anderen weichen aus den Umkreisen an deren Rand (zwei Durchgaenge: ein Ausweichen kann in den naechsten Kreis fuehren).
  const ist = new Set(gueltig)
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < n; i++) {
      if (ist.has(i)) continue
      for (const h of gueltig) {
        let dx = px[i] - px[h], dy = py[i] - py[h]
        let d = Math.hypot(dx, dy)
        if (d >= abstand) continue
        if (d < 1e-3) { [dx, dy] = richtung(i); d = 1 }
        px[i] = px[h] + (dx / d) * abstand
        py[i] = py[h] + (dy / d) * abstand
      }
    }
  }
  return { px, py, zelle: plaetze.zelle }
}

/**
 * Der hervorgehobene Punkt unter dem Zeiger, sonst -1 — sie haben Vorrang vor den uebrigen Punkten.
 * `weite(i)`: Trefferweite des Punkts `i` in den Einheiten der Plaetze.
 */
export function hervorTreffer(x: ArrayLike<number>, y: ArrayLike<number>, hervor: readonly number[], zx: number, zy: number, weite: (i: number) => number): number {
  let best = -1
  let bestD = Infinity
  for (const i of hervor) {
    const d = Math.hypot(x[i] - zx, y[i] - zy)
    if (d <= weite(i) && d < bestD) { bestD = d; best = i }
  }
  return best
}
