/**
 * Default-Sortierung der Galerie-Liste (pure Funktion, unit-testbar).
 *
 * Prioritaet:
 *  1. URL-Sort (`?sort=stars` fuer Mitglieder oder bei `starCountsPublic`,
 *     ADR 0012 | `?sort=rating`) — unveraendert.
 *  2. Konfigurierte Default-Sortierung der Library
 *     (`config.chat.gallery.defaultSortField` + `defaultSortDirection`),
 *     z. B. `date` absteigend. Das Feld muss eine bekannte Facette sein —
 *     unbekannte Felder werden LAUT geloggt und ignoriert (kein 500er wegen
 *     Config-Drift, aber auch kein stilles Schlucken).
 *  3. Standard: `{ year: -1, upsertedAt: -1 }` — neuste Ingest-Aenderung zuerst.
 */

import type { FacetDef } from '@/lib/chat/dynamic-facets'

export type GallerySortSpec = Record<string, 1 | -1>

/** Sentinel-Wert der Settings-UI fuer "Standard (zuletzt aktualisiert)". */
export const GALLERY_SORT_STANDARD_FIELD = 'upsertedAt'

export interface GalleryDefaultSortConfig {
  defaultSortField?: string
  defaultSortDirection?: 'asc' | 'desc'
}

export function buildGallerySort(args: {
  rawSort: string | null
  isMember: boolean
  /** ADR 0012: Schalter der Library; gibt `sort=stars` auch fuer Gaeste frei. */
  starCountsPublic?: boolean
  config?: GalleryDefaultSortConfig | null
  facetDefs: ReadonlyArray<Pick<FacetDef, 'metaKey'>>
}): GallerySortSpec {
  const { rawSort, isMember, starCountsPublic, config, facetDefs } = args

  // `sort=stars`: Mitglieder immer, Gaeste nur bei aktivem Schalter (die Route
  // weist den Fall vorher mit 403 ab, sortStarsPruefen in stern-filter.ts).
  // Tie-Break bei gleicher Sternezahl: Prioritaets-Index, dann juengste
  // Aenderung — Libraries ohne Index sortieren damit wie bisher nach Datum.
  if (rawSort === 'stars' && (isMember || starCountsPublic === true)) {
    return { favoriteCount: -1, 'docMetaJson.prioritaets_index': -1, upsertedAt: -1 }
  }
  // Oeffentlich: Prioritaets-Indikator (Teil des veroeffentlichten Dokuments).
  if (rawSort === 'rating') {
    return { 'docMetaJson.prioritaets_index': -1, year: -1, upsertedAt: -1 }
  }

  const field = (config?.defaultSortField ?? '').trim()
  if (field && field !== GALLERY_SORT_STANDARD_FIELD) {
    if (!facetDefs.some((d) => d.metaKey === field)) {
      console.error(
        `[gallery-sort] Konfiguriertes Sortierfeld "${field}" ist keine bekannte Facette — Standard-Sortierung wird verwendet.`,
      )
      return { year: -1, upsertedAt: -1 }
    }
    const dir: 1 | -1 = config?.defaultSortDirection === 'asc' ? 1 : -1
    // upsertedAt als deterministischer Tie-Breaker bei gleichen Werten.
    return { [`docMetaJson.${field}`]: dir, upsertedAt: -1 }
  }

  return { year: -1, upsertedAt: -1 }
}
