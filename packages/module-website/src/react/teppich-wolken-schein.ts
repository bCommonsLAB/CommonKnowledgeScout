/**
 * Was die Animation `wolke` lebendig macht, ohne die Physik zu aendern (Plan
 * `teppich-der-dokumente` §3.6, Owner 23.11.2026).
 *
 * - `TeppichStaffel`: Die Kandidaten der Suche werden nicht alle im selben Bild markiert, sondern
 *   nacheinander innerhalb von anderthalb Sekunden („eine dynamische Bewegung, nicht so ein
 *   ruckeliges Thema"). Jeder hat seinen Einsatz; ab da zaehlt er fuer die Physik und wird dunkel.
 * - `dreheWolke`: Die Wolke dreht sich ganz langsam um ihre Mitte („dass es nie ruht … so dezent,
 *   ganz langsam"). Gedreht wird nur das Bild, nicht die Rechnung; Punkte mit Gewicht 0 (die Belege
 *   der Storyline) bleiben, wo die Physik sie hinstellt — die Achse steht senkrecht.
 */

/** In dieser Zeit setzen alle neu gemeldeten Kandidaten ein. */
export const STAFFEL_MS = 1500
/** So lange wird ein einzelner Kandidat dunkel. */
const EINSATZ_MS = 500
/** Eine Umdrehung der Wolke dauert so lange. */
export const UMDREHUNG_MS = 12 * 60 * 1000

export class TeppichStaffel {
  private einsatz = new Map<number, number>()

  /** Meldet die Kandidaten zum Zeitpunkt `zeit`; liefert die, die schon eingesetzt haben. */
  schritt(kandidaten: ReadonlySet<number>, zeit: number): number[] {
    for (const i of [...this.einsatz.keys()]) if (!kandidaten.has(i)) this.einsatz.delete(i)
    const neu = [...kandidaten].filter((i) => !this.einsatz.has(i))
    neu.forEach((i, k) => this.einsatz.set(i, zeit + (k * STAFFEL_MS) / Math.max(1, neu.length)))
    return [...kandidaten].filter((i) => (this.einsatz.get(i) ?? Infinity) <= zeit)
  }

  /** Wie weit Kandidat `i` schon dunkel ist (0..1). */
  staerke(i: number, zeit: number): number {
    const t = this.einsatz.get(i)
    return t === undefined ? 0 : Math.min(1, Math.max(0, (zeit - t) / EINSATZ_MS))
  }
}

/** Winkel der Drehung zum Zeitpunkt `zeit` (Bogenmass). */
export function drehWinkel(zeit: number): number {
  return ((zeit % UMDREHUNG_MS) / UMDREHUNG_MS) * 2 * Math.PI
}

/** Dreht die Lagen um (`mx`, `my`); `gewicht(i)` 0..1 sagt, wie weit Punkt `i` mitdreht. */
export function dreheWolke(x: Float32Array, y: Float32Array, mx: number, my: number, zeit: number, gewicht: (i: number) => number): void {
  const winkel = drehWinkel(zeit)
  const c = Math.cos(winkel)
  const s = Math.sin(winkel)
  for (let i = 0; i < x.length; i++) {
    const g = gewicht(i)
    if (g <= 0) continue
    const dx = x[i] - mx
    const dy = y[i] - my
    x[i] += (mx + dx * c - dy * s - x[i]) * g
    y[i] += (my + dx * s + dy * c - y[i]) * g
  }
}
