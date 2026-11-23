/**
 * Zeiten und Eingabe der Animation `wolke` (Plan `teppich-der-dokumente` §3.6, Owner 23.11.2026:
 * „flüssig, weich, alles langsamer"). Hier stellt man das Tempo nach.
 */

import type { TeppichPhase } from '..'
import type { WolkenStufe } from './teppich-wolken-kraefte'

export const SAMMELN_MS = 1400
export const EXPLOSION_MS = 5000
export const HOECHSTENS_MS = 10000
/** Naeher als so (Pixel) an seinem Platz gilt ein Beleg als angekommen. */
export const AM_PLATZ = 2.5
/** Darunter ruht die Rechnung in der Stufe `frei`. */
export const SCHLAF_ALPHA = 0.004
/** So lange waechst beim Loslassen der Zug an den Ort. */
export const LOSLASSEN_MS = 7000
/** Zeitlupe: ein Rechenschritt je Takt, dazwischen ueberblendet. */
export const TAKT_MS = 50
/**
 * Storyline: In diesem Takt setzen die Belege nacheinander ein, in der Reihenfolge ihrer Nummern
 * (Owner 23.11.2026: „es muss nicht gleichzeitig sein"); jeder fliegt ab seinem Einsatz an seinen Platz.
 */
export const BELEG_TAKT_MS = 150
/** So schnell wird ein Beleg bei seinem Einsatz als gewaehlt markiert. */
export const BELEG_MARKE_MS = 300
/** So lange wachsen die Kraefte einer neuen Stufe an. */
export const EINBLENDEN_MS: Record<WolkenStufe, number> = { sammeln: 900, explosion: 0, auswahl: 3000, storyline: 2500, frei: 0 }

/** Weicher Verlauf 0..1 (langsam an, langsam aus). */
export const weich = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u) }

export interface WolkenSchrittEingabe {
  phase: TeppichPhase
  zeit: number
  breite: number
  hoehe: number
  zelle: number
  radien: Float32Array
  px: Float32Array
  py: Float32Array
  nachbarn: (i: number) => readonly number[]
  kandidaten: readonly number[]
  belege: readonly number[]
  onGelandet: () => void
}
