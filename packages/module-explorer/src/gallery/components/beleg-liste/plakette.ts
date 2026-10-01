/**
 * Status-Plakette (D3/D6): Symbol und i18n-Schluessel je Plakette — fuer
 * Belegkarte, Klimakarte und Detailansicht dieselbe Quelle. Die Farben
 * waehlt jede Stelle selbst (Karte: weiss auf Farbe, Liste: hell).
 */

import { Check, Clock, HelpCircle, X, type LucideIcon } from 'lucide-react'
import type { BelegPlakette } from '@ks/contracts'

export const PLAKETTE_SYMBOL: Record<BelegPlakette, LucideIcon> = {
  umsetzung: Check,
  geplant: Clock,
  pruefung: HelpCircle,
  abgelehnt: X,
}

/** i18n-Schluessel des Labels (`story.beleg.status.*`). */
export function plaketteLabelKey(plakette: BelegPlakette): string {
  return `story.beleg.status.${plakette}`
}
