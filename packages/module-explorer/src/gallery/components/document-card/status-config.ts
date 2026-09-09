/**
 * src/components/library/gallery/document-card/status-config.ts
 *
 * Pure-Helper fuer ClimateActionCard Status-Mapping.
 *
 * Aus document-card.tsx ausgegliedert (Welle 3-III-a, Schritt 1/N).
 * Verhalten 1:1 portiert — Char-Tests in
 * tests/unit/components/library/gallery/document-card.test.tsx
 * fixieren das Switch-Verhalten der DocumentCard.
 */

import { Check, X, Clock, HelpCircle } from 'lucide-react'

/**
 * Status-Konfiguration fuer ClimateAction (vereinfacht auf 4 Kategorien).
 *
 * Mapping der lv_bewertung-Werte auf 4 Status-Kategorien:
 * - aktiv (gruen): in_umsetzung, im_klimaplan, in_fachplaenen, neu_umsetzbar
 * - geplant (gelb): vertieft_pruefen
 * - abgelehnt (rot): nicht_umsetzbar
 * - offen (grau): unklar, undefined
 */
export type StatusColor = 'green' | 'yellow' | 'red' | 'gray'

export interface StatusConfig {
  label: string
  shortLabel: string
  color: StatusColor
  icon: 'check' | 'clock' | 'x' | 'help-circle'
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  aktiv: { label: 'Aktiv', shortLabel: 'Aktiv', color: 'green', icon: 'check' },
  geplant: { label: 'Geplant', shortLabel: 'Geplant', color: 'yellow', icon: 'clock' },
  abgelehnt: { label: 'Abgelehnt', shortLabel: 'Abgelehnt', color: 'red', icon: 'x' },
  offen: { label: 'Offen', shortLabel: 'Offen', color: 'gray', icon: 'help-circle' },
}

/**
 * Mapping von lv_bewertung auf vereinfachte Status-Kategorien.
 * Gibt 'offen' zurueck, wenn Bewertung undefined oder unbekannt ist.
 */
export function mapBewertungToStatus(bewertung?: string): string {
  if (!bewertung) return 'offen'
  switch (bewertung) {
    case 'in_umsetzung':
    case 'im_klimaplan':
    case 'in_fachplaenen':
    case 'neu_umsetzbar':
      return 'aktiv'
    case 'vertieft_pruefen':
      return 'geplant'
    case 'nicht_umsetzbar':
      return 'abgelehnt'
    case 'unklar':
    default:
      return 'offen'
  }
}

/**
 * Icon-Map fuer die Status-Symbole.
 * Die Reihenfolge entspricht den 4 Status-Kategorien.
 */
export const STATUS_ICON_MAP = {
  check: Check,
  clock: Clock,
  x: X,
  'help-circle': HelpCircle,
} as const
