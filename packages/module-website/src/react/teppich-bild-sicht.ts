/**
 * Sicht der Graph-Ansicht auf die Lagen der Punkte (aus `teppich-bild.ts` herausgeloest,
 * 24.11.2026, Dateigrenze): Vergroesserung und Ausschnitt, vor dem Zeichnen angewandt.
 */

import type { TeppichBildLage } from './teppich-bild'
import type { TeppichSzenenStand } from './teppich-zeichnen'

const sichtX = { a: new Float32Array(0) }
const sichtY = { a: new Float32Array(0) }
const sichtR = { a: new Float32Array(0) }

/**
 * Graph-Ansicht: Die Lagen wandern mit Vergroesserung und Ausschnitt, die Punkte selbst wachsen
 * nur mit der Wurzel — beim Hineinzoomen ruecken sie auseinander, statt zu Flecken zu werden.
 * Linien und Schrift behalten ihre Staerke.
 */
export function inSicht(s: TeppichSzenenStand, b: TeppichBildLage): [TeppichSzenenStand, TeppichBildLage] {
  const { z, x: tx, y: ty } = b.sicht
  if (z === 1 && tx === 0 && ty === 0) return [s, b]
  const n = b.x.length
  if (sichtX.a.length !== n) { sichtX.a = new Float32Array(n); sichtY.a = new Float32Array(n); sichtR.a = new Float32Array(n) }
  const w = Math.sqrt(z)
  for (let i = 0; i < n; i++) { sichtX.a[i] = b.x[i] * z + tx; sichtY.a[i] = b.y[i] * z + ty; sichtR.a[i] = s.radien[i] * w }
  const heimat = (i: number): [number, number] => { const [hx, hy] = b.heimat(i); return [hx * z + tx, hy * z + ty] }
  return [{ ...s, radien: sichtR.a }, { ...b, x: sichtX.a, y: sichtY.a, heimat }]
}
