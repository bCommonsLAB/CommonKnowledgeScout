/**
 * @fileoverview Detail-View-Type Utilities
 * 
 * @description
 * Helper-Funktionen für die Bestimmung des Detail-View-Types aus Frontmatter mit Fallback auf Library-Config.
 */

import type { TemplatePreviewDetailViewType } from './template-types'
import type { LibraryChatConfig } from '@/types/library'

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
  // 1. Prüfe Frontmatter
  const frontmatterDetailViewType = meta.detailViewType
  if (typeof frontmatterDetailViewType === 'string') {
    const validTypes: TemplatePreviewDetailViewType[] = ['book', 'session', 'testimonial', 'blog', 'climateAction', 'divaDocument']
    if (validTypes.includes(frontmatterDetailViewType as TemplatePreviewDetailViewType)) {
      return frontmatterDetailViewType as TemplatePreviewDetailViewType
    }
  }
  
  // 2. Fallback: Library-Config
  const configDetailViewType = libraryConfig?.gallery?.detailViewType
  const validLibraryTypes: TemplatePreviewDetailViewType[] = ['book', 'session', 'testimonial', 'blog', 'climateAction', 'divaDocument']
  if (typeof configDetailViewType === 'string' && validLibraryTypes.includes(configDetailViewType as TemplatePreviewDetailViewType)) {
    return configDetailViewType as TemplatePreviewDetailViewType
  }
  
  // 3. Fallback: Default
  return 'book'
}
