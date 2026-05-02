/**
 * src/components/library/gallery/gallery-root/helpers.ts
 *
 * Pure-Helpers fuer GalleryRoot — aus gallery-root.tsx ausgegliedert
 * (Welle 3-III-a, Schritt 2/N).
 *
 * Verhalten 1:1 portiert. Keine React-Imports, keine Side-Effects.
 */

import type { TemplatePreviewDetailViewType } from '@/lib/templates/template-types'

/**
 * Liste aller gueltigen DetailViewTypes (Plan-Welle 3-III).
 *
 * Konstante ausserhalb der Komponente, damit useMemo-Dependencies stabil
 * bleiben (eslint react-hooks/exhaustive-deps).
 */
export const VALID_DETAIL_VIEW_TYPES: TemplatePreviewDetailViewType[] = [
  'book',
  'session',
  'climateAction',
  'testimonial',
  'blog',
  'divaDocument',
  'divaTexture',
  'refurbedDevice',
]

/**
 * Pure-Helper fuer detailViewType-Validierung.
 *
 * Akzeptiert einen unbekannten Wert (z.B. aus Library-Config) und
 * gibt entweder den validierten Typ zurueck oder den Default 'book'.
 *
 * KEIN silent fallback fuer ungueltige Werte — der Default ist
 * dokumentiert, der Aufrufer kennt das Verhalten.
 */
export function resolveInitialDetailViewType(value: unknown): TemplatePreviewDetailViewType {
  if (typeof value !== 'string') return 'book'
  if (VALID_DETAIL_VIEW_TYPES.includes(value as TemplatePreviewDetailViewType)) {
    return value as TemplatePreviewDetailViewType
  }
  return 'book'
}

/**
 * Liest groupByField aus der Library-Config.
 *
 * Default: 'year'. Akzeptiert nur nicht-leere Strings — leere oder
 * fehlende Werte fallen auf 'year' zurueck (dokumentierter Default).
 */
export function resolveGroupByField(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value
  return 'year'
}

export interface FacetTableColumn {
  metaKey: string
  label?: string
}

/**
 * Filter-Helper fuer tableColumnFacets:
 * Gibt nur Facets zurueck, die `showInTable === true` haben und
 * einen nicht-leeren `metaKey` besitzen.
 *
 * Aus dem useMemo in gallery-root.tsx ausgegliedert.
 */
export function pickFacetsForTableColumns(
  facets: unknown,
): FacetTableColumn[] | undefined {
  if (!Array.isArray(facets)) return undefined
  const filtered = (facets as Array<{ metaKey?: string; label?: string; showInTable?: boolean }>)
    .filter((f) => f.showInTable === true && f.metaKey && f.metaKey.length > 0)
    .map((f) => ({ metaKey: f.metaKey!, label: f.label }))
  return filtered
}

/**
 * Bestimmt den DetailViewType fuer ein einzelnes Dokument (DetailOverlay).
 *
 * Reihenfolge:
 * 1. Wenn doc.detailViewType gesetzt UND in VALID_DETAIL_VIEW_TYPES,
 *    nimm diesen.
 * 2. Sonst: nutze den Library-Default (libraryDetailViewType).
 * 3. Wenn auch der Library-Default unbekannt ist: 'book' als Fallback.
 *
 * Aus dem useMemo `detailViewTypeForDoc` ausgegliedert.
 */
export function resolveDetailViewTypeForDoc(
  perDocViewType: unknown,
  libraryFallback: TemplatePreviewDetailViewType,
): TemplatePreviewDetailViewType {
  if (
    typeof perDocViewType === 'string' &&
    VALID_DETAIL_VIEW_TYPES.includes(perDocViewType as TemplatePreviewDetailViewType)
  ) {
    return perDocViewType as TemplatePreviewDetailViewType
  }
  return VALID_DETAIL_VIEW_TYPES.includes(libraryFallback) ? libraryFallback : 'book'
}
