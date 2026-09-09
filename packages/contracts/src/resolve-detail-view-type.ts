/**
 * @fileoverview Welcher Renderer-Typ fuer ein Dokument gilt — Frontmatter vor Library-Config vor `book`.
 *
 * Seit M4h in `@ks/contracts`: Die Regel liest persistierte Werte (Frontmatter,
 * Library-Config) und gehoert damit zum Vertrag, nicht zur Vorlagen-Logik.
 * 
 * @description
 * Helper-Funktionen für die Bestimmung des Detail-View-Types aus Frontmatter mit Fallback auf Library-Config.
 */

import type { LibraryChatConfig } from './library-chat'
import { isDetailViewType, type DetailViewType } from './detail-view-type'

/**
 * Bestimmt den Detail-View-Type aus bereits geparstem Frontmatter mit Fallback auf Library-Config.
 * 
 * **Wichtig**: Diese Funktion erwartet bereits geparstes Frontmatter (kein File-Loading!).
 * 
 * @param meta Bereits geparstes Frontmatter-Meta-Objekt (z.B. aus `parseFrontmatter()`)
 * @param libraryConfig Optional: Library-Chat-Config für Fallback
 * @returns Detail-View-Type (Standard: 'book')
 */
export function getDetailViewType(
  meta: Record<string, unknown>,
  libraryConfig?: LibraryChatConfig
): DetailViewType {
  // Gueltigkeit gegen die zentrale Registry — hier standen frueher zwei
  // eigene Kopien der Werteliste (Galerie-Audit, Befund 3c).

  // 1. Prüfe Frontmatter
  if (isDetailViewType(meta.detailViewType)) {
    return meta.detailViewType
  }

  // 2. Fallback: Library-Config
  const configDetailViewType = libraryConfig?.gallery?.detailViewType
  if (isDetailViewType(configDetailViewType)) {
    return configDetailViewType
  }

  // 3. Fallback: Default
  return 'book'
}
