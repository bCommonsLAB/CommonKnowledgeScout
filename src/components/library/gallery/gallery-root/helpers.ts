/**
 * src/components/library/gallery/gallery-root/helpers.ts
 *
 * Pure-Helpers fuer GalleryRoot — aus gallery-root.tsx ausgegliedert
 * (Welle 3-III-a, Schritt 2/N).
 *
 * Keine React-Imports. Reine Helper — Ausnahme: `resolveDetailViewTypeForDoc`
 * loggt unbekannte Typen explizit (no-silent-fallbacks.mdc).
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
 * KEIN stiller Fallback (no-silent-fallbacks.mdc): Ein gesetzter, aber
 * unbekannter `detailViewType` (z.B. Template erzeugt einen nicht
 * registrierten Typ) wird EXPLIZIT geloggt, statt unbemerkt als 'book' zu
 * rendern. Ein fehlender (undefined/leerer) Wert ist der dokumentierte
 * Normalfall und wird nicht geloggt.
 *
 * Aus dem useMemo `detailViewTypeForDoc` ausgegliedert.
 */
export function resolveDetailViewTypeForDoc(
  perDocViewType: unknown,
  libraryFallback: TemplatePreviewDetailViewType,
): TemplatePreviewDetailViewType {
  if (typeof perDocViewType === 'string' && perDocViewType.length > 0) {
    if (VALID_DETAIL_VIEW_TYPES.includes(perDocViewType as TemplatePreviewDetailViewType)) {
      return perDocViewType as TemplatePreviewDetailViewType
    }
    console.warn(
      `[detailViewType] Unbekannter detailViewType "${perDocViewType}" am Dokument — Fallback auf Library-Default "${libraryFallback}". Template/Registry pruefen.`,
    )
  }
  if (VALID_DETAIL_VIEW_TYPES.includes(libraryFallback)) return libraryFallback
  console.warn(
    `[detailViewType] Ungueltiger Library-Default "${libraryFallback}" — Fallback auf "book". Library-Konfiguration pruefen.`,
  )
  return 'book'
}
