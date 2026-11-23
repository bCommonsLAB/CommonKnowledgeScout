/**
 * Ein Bild des Teppichs der Dokumente zeichnen (Plan `teppich-der-dokumente`, T3/T4).
 *
 * Die Szene rechnet die Lagen, hier wird gezeichnet: alle Punkte blass; beim Rechnen die
 * Auswahl der Suche deutlicher; in der Verdichtung die Storyline — die Belege als Kreise mit
 * Nummer, daneben der Titel. Daheim in der Wolke (T5b): bei der Antwort das Sternbild der Belege
 * mit Ringen und ihren Linien zu den Nachbarn, beim Ueberfahren der Ring um den Punkt und seine
 * Linien (E9: Linien nur dort). Keine Jahreszahlen mehr (E8).
 */

import { leinwandBereit, zeichneFaden, zeichneNachbarLinien, zeichnePunkte, zeichneRinge, type TeppichSzenenStand } from './teppich-zeichnen'

export interface TeppichBildLage {
  x: Float32Array
  y: Float32Array
  /** Belege in der Reihenfolge ihrer Nummern (Indizes). */
  belegIndex: readonly number[]
  /** Kandidaten der Suche (Indizes, T4). */
  kandidaten: ReadonlySet<number>
  /** Die Punkte liegen an ihren Plaetzen in der Wolke (nicht im Schwarm). */
  daheim: boolean
  /** Anteil 0..1, wie weit Nummern und Titel der Storyline eingeblendet sind. */
  titel: number
  /**
   * Anteil 0..1, wie weit die Storyline das Knaeuel der Kandidaten abgeloest hat (Animation
   * `wolke`); der Schwarm kennt kein Ueberblenden und gibt 1.
   */
  uebergang: number
  /** Wie weit Kandidat `i` schon markiert ist (0..1); sie setzen nacheinander ein. */
  kandStaerke: (i: number) => number
  /** Storyline: wie weit der `k`-te Beleg als gewaehlt markiert ist (0..1); im Takt nacheinander. */
  belegMarke: (k: number) => number
  /** Fester Platz eines Punkts samt Schweben. */
  heimat: (i: number) => [number, number]
}

const STORY_R = 11
/** Deckkraft der ersten Auswahl in der Wolke: waehrend der Frage und hinter der Antwort. */
const KANDIDAT = 0.22
const KANDIDAT_HINTEN = 0.14
/** Die Faeden der ersten Auswahl sind deutlich blasser als die der Belege. */
const FADEN_KANDIDAT = 0.35

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
    const u = b.belegMarke(k)
    // Vom Kandidaten (dunkel, etwas groesser) zum Kreis der Storyline, dann zum Kreis mit Nummer.
    const basis = s.radien[i] * (1.15 + 0.45 * u)
    const r = basis + (STORY_R - basis) * b.titel
    const von = s.animation === 'wolke' ? KANDIDAT : 0.5
    ctx.globalAlpha = von + (0.85 - von) * u
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

/**
 * Animation `wolke` (Owner 23.11.2026): Die Verbindungen sichtbar machen, solange sich etwas formt —
 * wie die Kanten der Graph-Ansicht. Blass das ganze Netz, deutlicher die Faeden der Gewaehlten.
 */
function zeichneVerbindungen(ctx: CanvasRenderingContext2D, s: TeppichSzenenStand, b: TeppichBildLage, belege: ReadonlySet<number>, kandidaten: ReadonlySet<number>): void {
  if (s.phase !== 'sucht' && s.phase !== 'landet') return
  ctx.globalAlpha = 0.05
  ctx.lineWidth = 0.6
  ctx.beginPath()
  for (let i = 0; i < b.x.length; i++) {
    for (const j of s.punkte[i].nachbarn) {
      if (j <= i) continue
      ctx.moveTo(b.x[i], b.y[i])
      ctx.lineTo(b.x[j], b.y[j])
    }
  }
  ctx.stroke()
  // Die Faeden der Kandidaten blenden aus, die der Belege ein (in der Suche: u = 0, nur Kandidaten).
  const u = s.phase === 'landet' ? b.uebergang : 0
  const faeden = (folge: readonly number[], staerke: number) => {
    if (folge.length === 0 || staerke <= 0.01) return
    ctx.globalAlpha = 0.3 * staerke
    for (const i of folge) zeichneNachbarLinien(ctx, b.x, b.y, i, s.punkte[i].nachbarn)
    ctx.globalAlpha = 0.45 * staerke
    zeichneFaden(ctx, folge.map((i) => ({ x: b.x[i], y: b.y[i] })))
  }
  const markiert = [...kandidaten].filter((i) => b.kandStaerke(i) > 0)
  if (belege.size > 0) {
    faeden(markiert.filter((i) => !belege.has(i)), FADEN_KANDIDAT * (1 - u))
    // Der Faden der Kette waechst mit: er laeuft nur durch die schon markierten Belege.
    faeden(b.belegIndex.filter((_, k) => b.belegMarke(k) > 0), 1)
  } else faeden(markiert, FADEN_KANDIDAT * (1 - u))
}

export function zeichneTeppich(cv: HTMLCanvasElement, s: TeppichSzenenStand, b: TeppichBildLage): void {
  const ctx = leinwandBereit(cv, s.breite, s.hoehe)
  if (!ctx) return
  const belege = new Set(s.phase === 'landet' || s.phase === 'antwort' ? b.belegIndex : [])
  // Waehrend die Storyline das Knaeuel abloest, gleitet die Helligkeit der Wolke mit.
  const verblassen = s.phase === 'landet' && b.uebergang < 1
  // Wolke (Owner 23.11.2026): Die erste Auswahl bleibt markiert, auch in der Storyline und hinter der
  // Antwort — man sieht, dass die Belege aus ihr kommen. Der Schwarm zeigt sie nur in der Suche.
  const bleibt = s.animation === 'wolke' && (s.phase === 'landet' || s.phase === 'antwort')
  const kandidaten = s.phase === 'sucht' || bleibt ? b.kandidaten : new Set<number>()
  ctx.clearRect(0, 0, s.breite, s.hoehe)
  ctx.fillStyle = s.farbe
  ctx.strokeStyle = s.farbe
  // Owner 22.11.2026: gross und blass.
  // Hinter der Antwort und in Ruhe heller, damit die Wolke beim Lesen nicht stoert (Owner 23.11.2026).
  const blass = s.phase === 'sucht' ? 0.22 : s.abgetaucht ? 0.32 : s.phase === 'landet' ? 0.15 : 0.08
  ctx.globalAlpha = verblassen ? 0.22 + (blass - 0.22) * b.uebergang : blass
  zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => !belege.has(i))
  // Die Kandidaten werden einzeln dunkel (jeder mit seinem Einsatz), nicht alle im selben Bild.
  // Dezent: ein dunkleres Grau als die uebrige Wolke, kein Schwarz — schwarz werden erst die Belege.
  const dunkel = s.animation !== 'wolke' ? 0.5 : s.phase === 'antwort' ? KANDIDAT_HINTEN : KANDIDAT
  for (const i of kandidaten) {
    const w = b.kandStaerke(i)
    if (w <= 0 || belege.has(i)) continue
    ctx.globalAlpha = dunkel * w
    ctx.beginPath()
    ctx.arc(b.x[i], b.y[i], s.radien[i] * (1 + 0.15 * w), 0, 6.2832)
    ctx.fill()
  }
  if (s.animation === 'wolke') zeichneVerbindungen(ctx, s, b, belege, kandidaten)
  if (s.phase === 'landet') zeichneStoryline(ctx, s, b)
  else if (s.phase === 'antwort' && belege.size > 0) {
    // Beim Erkunden: das Sternbild der Belege an ihren festen Plaetzen, mit Ring und Nummer.
    if (b.daheim) {
      const heim = b.belegIndex.map((i, k) => { const [x, y] = b.heimat(i); return { x, y, r: s.radien[i], nummer: k + 1 } })
      ctx.globalAlpha = 0.1
      for (const i of b.belegIndex) zeichneNachbarLinien(ctx, b.x, b.y, i, s.punkte[i].nachbarn)
      ctx.globalAlpha = 0.18
      zeichneFaden(ctx, heim)
      ctx.globalAlpha = 0.45
      zeichneRinge(ctx, heim)
    }
    ctx.globalAlpha = 0.28
    zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => belege.has(i), 1.3)
  }
  // Ueberfahren: Ring um den Punkt, Linien zu seinen Nachbarn, die Nachbarn etwas kraeftiger.
  if (b.daheim && s.ueber >= 0 && s.ueber < b.x.length) {
    const nachbarn = s.punkte[s.ueber].nachbarn
    ctx.globalAlpha = 0.5
    zeichneNachbarLinien(ctx, b.x, b.y, s.ueber, nachbarn)
    zeichnePunkte(ctx, b.x, b.y, s.radien, (i) => nachbarn.includes(i), 1.2)
    ctx.globalAlpha = 1
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(b.x[s.ueber], b.y[s.ueber], s.radien[s.ueber] + 4, 0, 6.2832)
    ctx.stroke()
  }
}
