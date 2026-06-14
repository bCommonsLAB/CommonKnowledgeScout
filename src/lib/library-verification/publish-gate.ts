/**
 * Publish-Gate (Welle A1) — das Primitive fuer „nur Gepruefte duerfen publizieren".
 *
 * BEWUSST KEIN zweiter Publish-Pfad: A1 baut nur das Gate. Eingehaengt wird es am
 * idempotenten Promote-Job (ADR-0004 §E3 / Plan 2, WP-6), sobald dieser existiert
 * — dort, wo eine Submission in den Ziel-Provider geschrieben wird. Bis dahin ist
 * dies eine reine, getestete Hilfsfunktion ohne Aufrufer im Capture-Flow.
 *
 * Siehe docs/roadmap-formatunabhaengige-library-und-onboarding.md (A1, Konflikte).
 */

import type { LibraryVerificationStatus } from './types'

/** Nur eine als `verified` (geprueft) markierte Library darf publizieren. */
export function isLibraryPublishable(status: LibraryVerificationStatus): boolean {
  return status === 'verified'
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
