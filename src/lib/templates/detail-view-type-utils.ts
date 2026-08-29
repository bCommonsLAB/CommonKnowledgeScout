/**
 * @fileoverview Detail-View-Type Utilities
 * 
 * @description
 * Helper-Funktionen für die Bestimmung des Detail-View-Types aus Frontmatter mit Fallback auf Library-Config.
 */

import type { TemplatePreviewDetailViewType } from './template-types'
import type { LibraryChatConfig } from '@/types/library'
import { isValidDetailViewType } from '@/lib/detail-view-types/registry'

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
): TemplatePreviewDetailViewType {
  // Gueltigkeit gegen die zentrale Registry — hier standen frueher zwei
  // eigene Kopien der Werteliste (Galerie-Audit, Befund 3c).

  // 1. Prüfe Frontmatter
  if (isValidDetailViewType(meta.detailViewType)) {
    return meta.detailViewType
  }

  // 2. Fallback: Library-Config
  const configDetailViewType = libraryConfig?.gallery?.detailViewType
  if (isValidDetailViewType(configDetailViewType)) {
    return configDetailViewType
  }

  // 3. Fallback: Default
  return 'book'
}
