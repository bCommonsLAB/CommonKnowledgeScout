/**
 * Zeichnen und Messen fuer den Teppich der Dokumente (Plan `teppich-der-dokumente`, T3).
 *
 * Hilfen ohne React fuer `website-teppich.tsx`: Punkte, Ringe mit Nummern, der Faden der
 * Belege, die Vorbereitung der Leinwand und der Stand, den die Szene je Bild bekommt.
 */

import type { TeppichAnimation, TeppichKasten, TeppichPhase, TeppichPlaetze, TeppichPunkt } from '..'

/** Was die Szene je Bild vom Baustein bekommt (`TeppichSzene.setze`). */
export interface TeppichSzenenStand {
  punkte: readonly TeppichPunkt[]
  /** Feste Plaetze der Punkte in der Wolke (Pixel der Leinwand). */
  plaetze: TeppichPlaetze
  radien: Float32Array
  phase: TeppichPhase
  /** Belege in der Reihenfolge ihrer Nummern (fileIds). */
  belege: readonly string[]
  /** T4: Kandidaten der Suche (fileIds); leer, solange unbekannt. */
  kandidaten: readonly string[]
  abgetaucht: boolean
  /** `schwarm` (Standard) oder `wolke` (Physik, Plan §3.6). */
  animation: TeppichAnimation
  bewegung: boolean
  ueber: number
  /** Breite der Leinwand (= Sektion) und Hoehe des Kastens. */
  breite: number
  hoehe: number
  /** Der Kasten des Rasters in der Leinwand (so breit wie die Antwort). */
  kasten: TeppichKasten
  farbe: string
  /** Akzent der Site (`--site-accent-ink`) fuer die Belege; ohne Design-Profil die Schriftfarbe. */
  akzent: string
  onGelandet: () => void
}

/** Zeichnet die Punkte `auswahl` (oder alle) als Minikreise in einem Pfad. */
export function zeichnePunkte(
  ctx: CanvasRenderingContext2D, x: Float32Array, y: Float32Array, radien: Float32Array,
  auswahl: (i: number) => boolean, faktor = 1,
): void {
  ctx.beginPath()
  for (let i = 0; i < x.length; i++) {
    if (!auswahl(i)) continue
    const r = radien[i] * faktor
    if (r < 1.1) ctx.rect(x[i] - r, y[i] - r, r * 2, r * 2)
    else { ctx.moveTo(x[i] + r, y[i]); ctx.arc(x[i], y[i], r, 0, 6.2832) }
  }
  ctx.fill()
}

/** Ringe mit Nummern an den festen Plaetzen der Belege: Hier kommen sie her. */
export function zeichneRinge(ctx: CanvasRenderingContext2D, punkte: Array<{ x: number; y: number; r: number; nummer: number }>): void {
  ctx.lineWidth = 1
  ctx.font = '600 10px system-ui, sans-serif'
  ctx.textAlign = 'left'
  for (const p of punkte) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(5, p.r + 3.5), 0, 6.2832)
    ctx.stroke()
    ctx.fillText(String(p.nummer), p.x + Math.max(7, p.r + 6), p.y - 5)
  }
}

/** Linien von Punkt `i` zu seinen Nachbarn (Indizes), an ihrer aktuellen Lage (E9). */
export function zeichneNachbarLinien(ctx: CanvasRenderingContext2D, x: Float32Array, y: Float32Array, i: number, nachbarn: readonly number[]): void {
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const j of nachbarn) {
    if (j < 0 || j >= x.length) continue
    ctx.moveTo(x[i], y[i])
    ctx.lineTo(x[j], y[j])
  }
  ctx.stroke()
}

/** Der Faden: eine Linie durch die Belege in der Reihenfolge ihrer Nummern. */
export function zeichneFaden(ctx: CanvasRenderingContext2D, punkte: Array<{ x: number; y: number }>): void {
  if (punkte.length < 2) return
  ctx.lineWidth = 1.2
  ctx.beginPath()
  punkte.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
}

/** Bereitet eine Leinwand auf Groesse und Pixeldichte vor und gibt ihren Kontext zurueck. */
export function leinwandBereit(cv: HTMLCanvasElement, breite: number, hoehe: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(breite * dpr)
  const h = Math.round(hoehe * dpr)
  if (cv.width !== w) cv.width = w
  if (cv.height !== h) cv.height = h
  // Die vordere Leinwand bekommt ihre Hoehe hier, von der Szene: gleich der hinteren.
  const hoeheCss = `${hoehe}px`
  if (cv.style.height !== hoeheCss) cv.style.height = hoeheCss
  const ctx = cv.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}
