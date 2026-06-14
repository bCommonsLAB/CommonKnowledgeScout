/**
 * Publish-Gate (Welle A1) — Primitive rund um „nur Gepruefte duerfen publizieren".
 *
 * Owner-Entscheidung (2026-06-14): KEINE harte Sperre beim Veroeffentlichen,
 * sondern eine NICHT-blockierende **Warnung** — beim Veroeffentlichen und beim
 * Oeffnen einer oeffentlichen Library. Die aktive Durchsetzung ist daher
 * `getPublishVerificationWarning` (wirft nicht, blockiert nicht).
 *
 * `assertLibraryPublishable` bleibt als optionales Hart-Gate-Primitive erhalten
 * (z.B. fuer einen kuenftigen idempotenten Promote-Job, ADR-0004 §E3 / WP-6),
 * hat aber bewusst KEINEN Aufrufer — es gibt keinen zweiten Publish-Pfad.
 *
 * Siehe docs/roadmap-formatunabhaengige-library-und-onboarding.md (A1, Konflikte).
 */

import type { LibraryVerificationStatus } from './types'
import { getVerificationStatusDisplay } from './status-display'

/** Nur eine als `verified` (geprueft) markierte Library darf publizieren. */
export function isLibraryPublishable(status: LibraryVerificationStatus): boolean {
  return status === 'verified'
}

/** Kontext, in dem die Warnung erscheint (steuert nur den Wortlaut). */
export type PublishWarningContext = 'publish' | 'public-open'

/** Nicht-blockierende Veroeffentlichungs-Warnung (UI-tauglich, reine Daten). */
export interface PublishVerificationWarning {
  status: LibraryVerificationStatus
  title: string
  message: string
}

/** Kontext-spezifischer Titel — exhaustiv (kein stiller Default). */
const WARNING_TITLE: Record<PublishWarningContext, string> = {
  publish: 'Vor dem Veröffentlichen prüfen',
  'public-open': 'Diese Bibliothek ist noch nicht geprüft',
}

/** Kontext-spezifischer Schluss-Satz — exhaustiv (kein stiller Default). */
const WARNING_TAIL: Record<PublishWarningContext, string> = {
  publish: 'Sie können trotzdem veröffentlichen — eine Prüfung wird empfohlen.',
  'public-open': 'Inhalte sind möglicherweise noch nicht konsistent.',
}

/**
 * Liefert eine nicht-blockierende Warnung, wenn die Library NICHT `verified` ist,
 * sonst `null`. Bewusst ohne Seiteneffekt/Throw — die Veroeffentlichung wird NIE
 * verhindert (Owner-Entscheidung 2026-06-14: Warnung statt Guard).
 */
export function getPublishVerificationWarning(
  status: LibraryVerificationStatus,
  context: PublishWarningContext
): PublishVerificationWarning | null {
  if (isLibraryPublishable(status)) return null
  const display = getVerificationStatusDisplay(status)
  return {
    status,
    title: WARNING_TITLE[context],
    message: `${display.description} ${WARNING_TAIL[context]}`,
  }
}

/** Fehler fuer den Promote-Job, wenn die Quell-Library nicht geprueft ist. */
export class LibraryNotVerifiedError extends Error {
  readonly libraryId: string
  readonly status: LibraryVerificationStatus
  constructor(libraryId: string, status: LibraryVerificationStatus) {
    super(
      `Library „${libraryId}" ist nicht publizierbar (Status: ${status}). ` +
        'Vor dem Veroeffentlichen pruefen/reparieren.'
    )
    this.name = 'LibraryNotVerifiedError'
    this.libraryId = libraryId
    this.status = status
  }
}

/**
 * Wirft `LibraryNotVerifiedError`, wenn die Library nicht `verified` ist.
 * Vom kuenftigen Promote-Schritt VOR dem Schreiben in den Ziel-Provider aufzurufen.
 */
export function assertLibraryPublishable(
  libraryId: string,
  status: LibraryVerificationStatus
): void {
  if (!isLibraryPublishable(status)) {
    throw new LibraryNotVerifiedError(libraryId, status)
  }
}
