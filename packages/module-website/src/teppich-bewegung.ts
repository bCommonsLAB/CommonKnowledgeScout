/**
 * @fileoverview Teppich der Dokumente: Ablauf und Bewegung (Plan `teppich-der-dokumente`, T3).
 *
 * @description
 * Reine Funktionen ohne React und ohne Browser.
 *
 * Ablauf einer Frage (`naechstePhase`): `ruhe` → `sucht` (die Punkte schwaermen, mindestens
 * `SUCHE_MINDESTENS_MS`, auch wenn die Antwort frueher da ist) → `landet` (die zitierten fliegen
 * neben ihre Karten, alle anderen an ihren Platz) → `antwort`. Scheitert die Frage, endet der
 * Schwarm in `ruhe`.
 *
 * Schwarm (`schwarmSchritt`): Kreisen um einen Mittelpunkt, Zug zu einem eigenen Radius je Punkt,
 * eine gemeinsame Stroemung. Ohne Nachbarsuche, der Aufwand waechst nur mit der Zahl der Punkte.
 * Vorbild ist der Schwarm im Klickmodell (`docs/plans/assets/teppich-der-dokumente-prototyp.html`).
 */

import type { ChatProcessingStep } from '@ks/contracts'

export type TeppichPhase = 'ruhe' | 'sucht' | 'landet' | 'antwort'

/** Mindestdauer der Suche: Die Bewegung soll man sehen, auch bei einer Antwort aus dem Cache. */
export const SUCHE_MINDESTENS_MS = 2500
/** Dauer des Flugs neben die Karten bzw. zurueck an den Platz. */
export const FLUG_MS = 900

export interface TeppichAblaufEingabe {
  /** Die Sektion fragt gerade (Suche oder Schreiben). */
  laeuft: boolean
  /** Die letzte Frage ist gescheitert. */
  fehler: boolean
  /** Es gibt eine fertige Antwort mit Belegen. */
  hatAntwort: boolean
}

/** Naechste Phase. `seitSucheMs`: Zeit seit Beginn der Suche; `gelandet`: der Flug ist fertig. */
export function naechstePhase(vorher: TeppichPhase, e: TeppichAblaufEingabe, seitSucheMs: number, gelandet: boolean): TeppichPhase {
  if (e.laeuft) return 'sucht'
  switch (vorher) {
    case 'sucht':
      if (seitSucheMs < SUCHE_MINDESTENS_MS) return 'sucht'
      return e.fehler || !e.hatAntwort ? 'ruhe' : 'landet'
    case 'landet':
      return gelandet ? 'antwort' : 'landet'
    case 'ruhe':
      // Eine Antwort, die schon da war (Sitzung wiederhergestellt), fliegt nicht: sie steht.
      return e.hatAntwort ? 'antwort' : 'ruhe'
    case 'antwort':
      return e.hatAntwort ? 'antwort' : 'ruhe'
    default: {
      const unbekannt: never = vorher
      throw new Error(`Unbekannte Teppich-Phase: ${String(unbekannt)}`)
    }
  }
}

/** Eigene, wiederholbare Kennzahl 0..1 je Punkt (goldener Schnitt). */
export function punktSaat(i: number, versatz = 0): number {
  return ((i + 1) * 0.6180339887 + versatz) % 1
}

/** Versatz des leichten Schwebens in Ruhe (Pixel). */
export function driftVersatz(i: number, px: number, py: number, t: number, a: number, b: number): [number, number] {
  const s = punktSaat(i)
  return [
    a * Math.sin(t * (0.5 + s * 0.5) + s * 6.283) + b * Math.sin(py * 0.012 + t * 0.45),
    a * Math.cos(t * (0.45 + s * 0.5) + s * 9.42) + b * Math.cos(px * 0.009 + t * 0.4),
  ]
}

export interface TeppichSchwarm {
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
}

/** Startet den Schwarm an den aktuellen Lagen, mit kleinem eigenem Anstoss je Punkt. */
export function schwarmStart(x: Float32Array, y: Float32Array): TeppichSchwarm {
  const vx = new Float32Array(x.length)
  const vy = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) {
    vx[i] = (punktSaat(i) - 0.5) * 40
    vy[i] = (punktSaat(i, 0.37) - 0.5) * 40
  }
  return { x: Float32Array.from(x), y: Float32Array.from(y), vx, vy }
}

/**
 * Ein Schritt des Schwarms um `mitte` auf einer Flaeche `breite` × `hoehe` (siehe Datei-Kommentar).
 * `kreis` (T4, wahlweise): je Punkt der Anteil am Schwarm-Radius, auf dem er kreist; 0 = sein eigener.
 * So ziehen die Kandidaten der Suche auf einen inneren Kreis, der Rest nach aussen.
 */
export function schwarmSchritt(sw: TeppichSchwarm, dt: number, t: number, mitte: { x: number; y: number }, breite: number, hoehe: number, kreis?: Float32Array): void {
  const m = Math.min(breite, hoehe)
  const sc = m / 800
  const r = 0.46 * m
  const ex = Math.min(1.9, Math.max(1, breite / Math.max(1, hoehe)))
  const k = Math.min(1, dt * 3)
  for (let i = 0; i < sw.x.length; i++) {
    const s1 = punktSaat(i)
    const s2 = punktSaat(i, 0.37)
    const dx = (sw.x[i] - mitte.x) / ex
    const dy = sw.y[i] - mitte.y
    const d = Math.hypot(dx, dy) + 0.001
    const ux = dx / d
    const uy = dy / d
    const anteil = kreis && kreis[i] > 0 ? kreis[i] : 0.16 + 0.95 * s1
    const rho = r * anteil * (1 + 0.14 * Math.sin(t * 0.9 + s2 * 6.283))
    const vk = 150 * sc * (0.45 + 0.55 * Math.min(1, d / (0.35 * r)))
    const zug = (rho - d) * 1.6
    const a = Math.sin(sw.x[i] * 0.006 + t * 0.8) * 1.7 + Math.cos(sw.y[i] * 0.007 - t * 0.6) * 1.7 + s2
    const ve = 75 * sc
    const wx = (uy * vk + ux * zug) * ex + Math.cos(a) * ve
    const wy = -ux * vk + uy * zug + Math.sin(a) * ve
    sw.vx[i] += (wx - sw.vx[i]) * k
    sw.vy[i] += (wy - sw.vy[i]) * k
    sw.x[i] += sw.vx[i] * dt
    sw.y[i] += sw.vy[i] * dt
  }
}

/** Weicher Verlauf 0..1 fuer Fluege (langsam an, schnell, langsam aus). */
export function flugVerlauf(p: number): number {
  const q = Math.min(1, Math.max(0, p))
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2
}

/**
 * Auswahl der Suche (T4): die Dokumente, die dem Sprachmodell vorgelegt werden, aus dem letzten
 * Schritt `retrieval_complete`. Leer, solange die Suche laeuft, und bei Antworten aus dem Cache.
 */
export function kandidatenAusSchritten(schritte: readonly ChatProcessingStep[]): string[] {
  for (let i = schritte.length - 1; i >= 0; i--) {
    const s = schritte[i]
    if (s.type === 'retrieval_complete') return s.candidateFileIds ?? []
  }
  return []
}

/**
 * Kreise des Schwarms (T4): Belege der Antwort auf dem innersten Kreis (0,1 bis 0,16 des
 * Radius), Kandidaten der Suche auf einem inneren (0,3 bis 0,4), alle anderen weiter aussen
 * (0,62 bis 1,07), damit die Mitte frei wird. Ohne Kandidaten und Belege `undefined`: jeder Punkt
 * kreist auf seinem eigenen Radius.
 */
export function schwarmKreise(anzahl: number, kandidaten: ReadonlySet<number>, belege: ReadonlySet<number> = new Set()): Float32Array | undefined {
  if (kandidaten.size === 0 && belege.size === 0) return undefined
  const kreis = new Float32Array(anzahl)
  for (let i = 0; i < anzahl; i++) {
    kreis[i] = belege.has(i) ? 0.1 + 0.06 * punktSaat(i)
      : kandidaten.has(i) ? 0.3 + 0.1 * punktSaat(i)
        : 0.62 + 0.45 * punktSaat(i, 0.37)
  }
  return kreis
}

/** Wie lange die fertige Storyline steht, bevor die Antwort erscheint (ms) — Zeit zum Lesen. */
export const STORYLINE_MS = 3200

/**
 * Botschaft der Animation (Owner 22.11.2026): erklaert den Rechenweg in Worten. Stufen in dieser
 * Reihenfolge: 0 Dokumente werden durchsucht, 1 passende gefunden, 2 werden gewichtet, 3 die
 * Antwort entsteht. Liefert die Stufe, die die Meldungen des Servers schon erreicht haben.
 */
export type BotschaftsStufe = 0 | 1 | 2 | 3

export function botschaftsStufe(schritte: readonly ChatProcessingStep[]): BotschaftsStufe {
  let stufe: BotschaftsStufe = 0
  for (const s of schritte) {
    if (s.type === 'retrieval_complete' && stufe < 1) stufe = 1
    else if (s.type === 'prompt_building' && stufe < 2) stufe = 2
    else if ((s.type === 'prompt_complete' || s.type === 'llm_progress') && stufe < 3) stufe = 3
  }
  return stufe
}

/**
 * Lage der Storyline (Owner 22.11.2026): Die Belege der Antwort stehen als Liste in der Mitte der
 * Flaeche, untereinander in der Reihenfolge ihrer Nummern; rechts neben jedem Kreis der Titel.
 * Liefert die Mitte jedes Kreises; `zeile` ist der Abstand zweier Kreise, `x` die gemeinsame Spalte.
 */
export function storylineLage(anzahl: number, breite: number, hoehe: number): { x: number; ys: number[]; zeile: number } {
  // Hoechstens 40 px; bei vielen Belegen enger, die Liste bleibt in 72 % der Hoehe.
  const zeile = anzahl > 0 ? Math.min(40, (hoehe * 0.72) / anzahl) : 0
  const listenBreite = Math.min(560, breite - 48)
  const x = Math.max(24, (breite - listenBreite) / 2) + 14
  const oben = hoehe / 2 - ((anzahl - 1) * zeile) / 2
  return { x, ys: Array.from({ length: anzahl }, (_, k) => oben + k * zeile), zeile }
}
