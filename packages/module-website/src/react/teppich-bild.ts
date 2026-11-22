/**
 * Ein Bild des Teppichs der Dokumente zeichnen (Plan `teppich-der-dokumente`, T3/T4).
 *
 * Die Szene rechnet die Lagen, hier wird gezeichnet: alle Punkte blass; beim Rechnen die
 * Auswahl der Suche deutlicher; in der Verdichtung die Storyline — die Belege als Kreise mit
 * Nummer, daneben der Titel; danach die Belege etwas kraeftiger im weiterdrehenden Schwarm.
 * Im Raster: Jahreszahlen, beim Erkunden das Sternbild mit Ringen, der Ring um den ueberfahrenen
 * Punkt.
 */

import { leinwandBereit, zeichneFaden, zeichnePunkte, zeichneRinge, type TeppichSzenenStand } from './teppich-zeichnen'

export interface TeppichBildLage {
  x: Float32Array
  y: Float32Array
  /** Belege in der Reihenfolge ihrer Nummern (Indizes). */
  belegIndex: readonly number[]
  /** Kandidaten der Suche (Indizes, T4). */
  kandidaten: ReadonlySet<number>
  /** Die Punkte liegen im Raster (nicht im Schwarm). */
  imRaster: boolean
  /** Anteil 0..1, wie weit Nummern und Titel der Storyline eingeblendet sind. */
  titel: number
  /** Fester Platz eines Punkts samt Schweben. */
  heimat: (i: number) => [number, number]
}

const STORY_R = 11

/** Kuerzt den Titel auf die verfuegbare Breite (mit Auslassungszeichen). */
function passend(ctx: CanvasRenderingContext2D, text: string, breite: number): string {
  if (ctx.measureText(text).width <= breite) return text
  let t = text
  while (t.length > 4 && ctx.measureText(`${t}…`).width > breite) t = t.slice(0, -1)
  return `${t}…`
}

/** Storyline: Kreis mit Nummer (ausgestanzt), daneben der Titel. */
function zeichneStoryline(ctx: CanvasRenderingContext2D, s: TeppichSzenenStand, b: TeppichBildLage): void {
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  b.belegIndex.forEach((i, k) => {
    const r = s.radien[i] * 1.6 + (STORY_R - s.radien[i] * 1.6) * b.titel
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.arc(b.x[i], b.y[i], r, 0, 6.2832)
    ctx.fill()
    if (b.titel > 0) {
      ctx.globalAlpha = b.titel
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillText(String(k + 1), b.x[i], b.y[i] + 0.5)
      ctx.globalCompositeOperation = 'source-over'
    }
  })
  if (b.titel <= 0) return
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.globalAlpha = 0.9 * b.titel
  for (const i of b.belegIndex) {
    const x = b.x[i] + STORY_R + 10
    ctx.fillText(passend(ctx, s.punkte[i].titel, Math.max(60, s.breite - x - 24)), x, b.y[i])
  }
  ctx.textBaseline = 'alphabetic'
}

export function zeichneTeppich(cv: HTMLCanvasElement, s: TeppichSzenenStand, b: TeppichBildLage): void {
  const ctx = leinwandBereit(cv, s.breite, s.hoehe)
  if (!ctx) return
  const belege = new Set(s.phase === 'landet' || s.phase === 'antwort' ? b.belegIndex : [])
  const kandidaten = s.phase === 'sucht' ? b.kandidaten : new Set<number>()
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
  if (s.phase === 'landet') zeichneStoryline(ctx, s, b)
  else if (s.phase === 'antwort' && belege.size > 0) {
    // Beim Erkunden: das Sternbild der Belege an ihren festen Plaetzen, mit Ring und Nummer.
    if (b.imRaster) {
      const heim = b.belegIndex.map((i, k) => { const [x, y] = b.heimat(i); return { x, y, r: s.radien[i], nummer: k + 1 } })
      ctx.globalAlpha = 0.3
      zeichneFaden(ctx, heim)
      ctx.globalAlpha = 0.85
      zeichneRinge(ctx, heim)
    }
    ctx.globalAlpha = 0.45
    zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => belege.has(i), 1.3)
  }
  if (b.imRaster) {
    ctx.globalAlpha = 0.7
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const m of s.raster.jahrMarken) ctx.fillText(String(m.jahr), m.x, s.hoehe - 6)
    if (s.ueber >= 0 && s.ueber < b.x.length) {
      ctx.globalAlpha = 1
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(b.x[s.ueber], b.y[s.ueber], s.radien[s.ueber] + 4, 0, 6.2832)
      ctx.stroke()
    }
  }
}
