/**
 * Anzeige-Mapping des Verifikations-Status (Welle A2) — reine Datenfunktion.
 *
 * Bildet jeden Status auf Label/Badge-Variante/Beschreibung ab. EXHAUSTIVES
 * Record ueber alle Status-Werte (kein `default`-Zweig → ein neuer Status faellt
 * beim Kompilieren auf, statt still „neutral" zu werden, siehe
 * no-silent-fallbacks.mdc).
 */

import type { LibraryVerificationStatus } from './types'

/** Badge-Variante aus `@/components/ui/badge`. */
export type StatusBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface VerificationStatusDisplay {
  /** Sichtbares Label (deutsch). */
  label: string
  variant: StatusBadgeVariant
  /** Optionale Zusatzklassen (z.B. Gruen-Ton fuer „geprueft"). */
  className?: string
  /** Tooltip/Erklaerung. */
  description: string
}

export const VERIFICATION_STATUS_DISPLAY: Record<
  LibraryVerificationStatus,
  VerificationStatusDisplay
> = {
  verified: {
    label: 'Geprüft',
    variant: 'default',
    className: 'bg-emerald-600 hover:bg-emerald-600/80',
    description: 'Alle Dokumente erfüllen den Konsistenz-Contract.',
  },
  'needs-repair': {
    label: 'Reparaturbedürftig',
    variant: 'destructive',
    description: 'Mindestens ein Dokument hat Befunde — prüfen und reparieren.',
  },
  unchecked: {
    label: 'Ungeprüft',
    variant: 'secondary',
    description: 'Diese Bibliothek wurde noch nicht geprüft.',
  },
}

/** Liefert das Anzeige-Objekt fuer einen Status. */
export function getVerificationStatusDisplay(
  status: LibraryVerificationStatus
): VerificationStatusDisplay {
  return VERIFICATION_STATUS_DISPLAY[status]
}
