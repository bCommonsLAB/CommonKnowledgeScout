/**
 * Ein Bild des Teppichs der Dokumente zeichnen (Plan `teppich-der-dokumente`, T3/T4).
 *
 * Aus `teppich-szene.ts` herausgeloest (Dateigrenze): die Szene rechnet die Lagen, hier wird
 * gezeichnet — alle Punkte blass, beim Rechnen die Kandidaten der Suche deutlicher (T4), bei
 * stehender Antwort die Belege kraeftiger, der Faden nur bei einer Kartenspalte, beim Erkunden
 * das Sternbild mit Ringen, dazu Jahreszahlen und der Ring um den ueberfahrenen Punkt.
 */

import { leinwandBereit, zeichneFaden, zeichnePunkte, zeichneRinge, type TeppichSzenenStand } from './teppich-zeichnen'

export interface TeppichBildLage {
  x: Float32Array
  y: Float32Array
  /** Belege in der Reihenfolge ihrer Nummern (Indizes). */
  belegIndex: readonly number[]
  /** Kandidaten der Suche (Indizes, T4). */
  kandidaten: ReadonlySet<number>
  /** Belege, deren Marke gefunden wurde. */
  verankert: ReadonlySet<number>
  /** Anteil der Verzerrung 0..1. */
  zug: number
  /** Fester Platz eines Punkts samt Schweben. */
  heimat: (i: number) => [number, number]
}

export function zeichneTeppich(cv: HTMLCanvasElement, s: TeppichSzenenStand, b: TeppichBildLage): void {
  const ctx = leinwandBereit(cv, s.breite, s.hoehe)
  if (!ctx) return
  const antwort = s.phase === 'landet' || s.phase === 'antwort'
  const belege = new Set(antwort ? b.belegIndex : [])
  const kandidaten = s.phase === 'sucht' ? b.kandidaten : new Set<number>()
  const ruhig = s.phase === 'ruhe' || s.phase === 'antwort'
  ctx.clearRect(0, 0, s.breite, s.hoehe)
  ctx.fillStyle = s.farbe
  ctx.strokeStyle = s.farbe
  // Owner 22.11.2026: gross und blass.
  ctx.globalAlpha = s.phase === 'sucht' ? 0.22 : s.abgetaucht ? 0.32 : 0.15
  zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => !belege.has(i) && !kandidaten.has(i))
  if (kandidaten.size > 0) {
    ctx.globalAlpha = 0.5
    zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => kandidaten.has(i), 1.15)
  }
  if (ruhig) {
    ctx.globalAlpha = 0.7
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const m of s.raster.jahrMarken) ctx.fillText(String(m.jahr), m.x, s.hoehe - 6)
  }
  if (antwort && belege.size > 0) {
    // Beim Erkunden: das Sternbild der Belege an ihren festen Plaetzen, mit Ring und Nummer.
    if (s.abgetaucht && s.phase === 'antwort') {
      const heim = b.belegIndex.map((i, k) => { const [x, y] = b.heimat(i); return { x, y, r: s.radien[i], nummer: k + 1 } })
      ctx.globalAlpha = 0.3
      zeichneFaden(ctx, heim)
      ctx.globalAlpha = 0.85
      zeichneRinge(ctx, heim)
    }
    // Unter den Marken: der Faden nur, wo die Karten eine Spalte bilden (kein Zickzack im Raster).
    if (!s.abgetaucht && b.zug > 0.5) {
      const lage = b.belegIndex.filter((i) => b.verankert.has(i)).map((i) => ({ x: b.x[i], y: b.y[i] }))
      const xs = lage.map((p) => p.x)
      ctx.globalAlpha = 0.6
      if (lage.length > 1 && Math.max(...xs) - Math.min(...xs) < 16) zeichneFaden(ctx, lage)
    }
    ctx.globalAlpha = 0.7
    zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => belege.has(i), 1.3)
  }
  if (ruhig && s.ueber >= 0 && s.ueber < b.x.length) {
    ctx.globalAlpha = 1
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(b.x[s.ueber], b.y[s.ueber], s.radien[s.ueber] + 4, 0, 6.2832)
    ctx.stroke()
  }
}
