/**
 * Buehne der Animation `wolke` (Plan `teppich-der-dokumente` §3.6, Owner 23.11.2026): fuehrt je
 * Bild die Physik, den gestaffelten Einsatz der Kandidaten und die langsame Drehung zusammen.
 * Die Szene reicht die festen Plaetze herein und bekommt die Lagen des Bilds zurueck.
 */

import type { TeppichPhase } from '..'
import type { TeppichSzenenStand } from './teppich-zeichnen'
import { TeppichWolkenPhysik } from './teppich-wolken-physik'
import { TeppichStaffel, dreheWolke, drehWinkel } from './teppich-wolken-schein'
import { weich } from './teppich-wolken-takt'

/** So lange finden die Belege nach der Antwort in die Drehung der Wolke zurueck. */
const ZURUECK_MS = 5000

export class TeppichWolkenBuehne {
  private physik = new TeppichWolkenPhysik()
  private staffel = new TeppichStaffel()
  private phase: TeppichPhase = 'ruhe'
  private antwortSeit = Number.NEGATIVE_INFINITY
  private zeit = 0
  private mitte = { x: 0, y: 0 }

  /** Anteil 0..1 der eingeblendeten Titel der Storyline. */
  get titel(): number { return this.physik.titel }
  /** Anteil 0..1, wie weit die Storyline das Knaeuel abgeloest hat. */
  get uebergang(): number { return this.physik.uebergang }
  /** Wie weit Kandidat `i` schon markiert ist (0..1). */
  staerke = (i: number): number => this.staffel.staerke(i, this.zeit)
  /** Storyline: wie weit der `k`-te Beleg als gewaehlt markiert ist (0..1). */
  belegMarke = (k: number): number => this.physik.belegMarke(k)

  /**
   * Punkt `i` an die Stelle (`x`, `y`) des Bilds ziehen. Das Bild ist gedreht, die Rechnung nicht:
   * die Stelle wird zurueckgedreht, dann haelt die Physik den Punkt dort fest.
   */
  zieh(i: number, x: number, y: number): void {
    const w = -drehWinkel(this.zeit)
    const dx = x - this.mitte.x
    const dy = y - this.mitte.y
    this.physik.zieh(i, this.mitte.x + dx * Math.cos(w) - dy * Math.sin(w), this.mitte.y + dx * Math.sin(w) + dy * Math.cos(w))
  }
  lasse(): void { this.physik.lasse() }

  /** Ein Bild: `x`/`y` kommen mit den festen Plaetzen und gehen mit den Lagen des Bilds. */
  schritt(s: TeppichSzenenStand, zeit: number, kandidaten: ReadonlySet<number>, belege: readonly number[], x: Float32Array, y: Float32Array): void {
    if (s.phase !== this.phase) {
      if (s.phase === 'antwort') this.antwortSeit = zeit
      this.phase = s.phase
    }
    this.zeit = zeit
    this.mitte = { x: s.breite / 2, y: s.hoehe / 2 }
    // In der Suche setzen die Kandidaten nacheinander ein; danach zaehlen alle.
    const aktiv = s.phase === 'sucht' ? this.staffel.schritt(kandidaten, zeit) : [...kandidaten]
    this.physik.schritt({
      phase: s.phase, zeit, breite: s.breite, hoehe: s.hoehe, zelle: s.plaetze.zelle, radien: s.radien,
      px: s.plaetze.px, py: s.plaetze.py, nachbarn: (i) => s.punkte[i].nachbarn, kandidaten: aktiv, belege,
      onGelandet: s.onGelandet,
    }, x, y)
    // Die Belege der Storyline drehen nicht mit (die Achse steht senkrecht); nach der Antwort
    // finden sie weich in die Drehung zurueck.
    const nummer = new Map(belege.map((i, k) => [i, k]))
    const zurueck = s.phase === 'antwort' ? weich((zeit - this.antwortSeit) / ZURUECK_MS) : 1
    dreheWolke(x, y, s.breite / 2, s.hoehe / 2, zeit, (i) => {
      const k = nummer.get(i)
      if (k === undefined) return 1
      return s.phase === 'landet' ? 1 - this.physik.belegEin(k) : zurueck
    })
  }
}
