/**
 * Default-Sortierung der Galerie-Liste (pure Funktion, unit-testbar).
 *
 * Prioritaet:
 *  1. URL-Sort (`?sort=stars` Member-only | `?sort=rating`) — unveraendert.
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
  config?: GalleryDefaultSortConfig | null
  facetDefs: ReadonlyArray<Pick<FacetDef, 'metaKey'>>
}): GallerySortSpec {
  const { rawSort, isMember, config, facetDefs } = args

  // Member-only: `sort=stars` (keine weiche Privilege-Escalation fuer Gaeste).
  if (rawSort === 'stars' && isMember) {
    return { favoriteCount: -1, year: -1, upsertedAt: -1 }
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
