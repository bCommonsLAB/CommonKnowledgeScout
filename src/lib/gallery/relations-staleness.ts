/**
 * @fileoverview Staleness-Hash für berechnete Beziehungs-Kanten (Zielbild §5.5).
 *
 * @description
 * Berechnet einen stabilen Hash über den Katalog-Stand einer Library (welche
 * Dokumente existieren + wann zuletzt geändert). Wird beim Recompute auf die
 * Kanten gestempelt (`catalogHash`) und in der GET-Route gegen den aktuellen
 * Stand verglichen — weicht er ab, hat sich der Katalog seit der letzten
 * Berechnung verändert und die Kanten gelten als VERALTET.
 *
 * Bewusst rein + ohne I/O (testbar). Kein Silent Fallback: ein Dokument ohne
 * Änderungs-Stempel fließt mit leerem Stempel ein (sichtbar im Hash), wird
 * nicht stillschweigend ausgelassen.
 */

import { createHash } from 'crypto'

/** Minimaler Katalog-Eintrag für den Staleness-Hash. */
export interface CatalogHashEntry {
  fileId: string
  /** Änderungs-Signatur (z.B. `upsertedAt`/`updatedAt` ISO-String). */
  updatedAt?: string
}

/**
 * Stabiler SHA-256-Hash über die sortierte Liste `(fileId, updatedAt)`.
 * Reihenfolge-unabhängig (sortiert) und damit reproduzierbar.
 */
export function computeCatalogHash(entries: CatalogHashEntry[]): string {
  const normalized = entries
    .map((e) => `${e.fileId}:${e.updatedAt ?? ''}`)
    .sort()
    .join('|')
  return createHash('sha256').update(normalized).digest('hex')
}
