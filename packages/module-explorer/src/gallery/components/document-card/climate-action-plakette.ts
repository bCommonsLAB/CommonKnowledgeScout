/**
 * Farben der Status-Plaketten auf der Klima-Karte (weiss auf Farbe) — fuer die
 * komfortable Pille und den kompakten Punkt dieselbe Quelle.
 */

import type { BelegPlakette } from '@ks/contracts'

export const PLAKETTE_KARTE: Record<BelegPlakette, string> = {
  umsetzung: 'bg-green-600/90 text-white',
  geplant: 'bg-blue-600/90 text-white',
  pruefung: 'bg-amber-500/90 text-white',
  abgelehnt: 'bg-red-500/90 text-white',
}

/** Farbe fuer einen Status, den die Registry nicht kennt (wird roh gezeigt, nicht geraten). */
export const PLAKETTE_ROH = 'bg-gray-500/90 text-white'
