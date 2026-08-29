/**
 * column-sort — serverseitige (globale) Spalten-Sortierung der Tabellenansicht.
 *
 * Der Client sendet `?sortField=<key>&sortDir=asc|desc`; hier wird der Wunsch
 * gegen die Facetten-Definitionen validiert (Whitelist, keine beliebigen
 * Mongo-Pfade von außen) und in Aggregation-Stages übersetzt, die
 * `vector-repo.findDocs` vor `$skip/$limit` einsetzt. Damit sortiert der
 * Server über den GESAMTEN gefilterten Bestand — nicht nur über die im
 * Browser bereits geladenen Seiten.
 *
 * Sortier-Semantik (mit dem User geklärt, 2026-07-07):
 *  - 0 ist ein ECHTER Wert (sortiert normal mit); nur null/fehlend/'' ans Ende.
 *  - Strings werden case-insensitiv verglichen ($toLower), Arrays bleiben roh.
 *  - Sekundärschlüssel year/upsertedAt/_id halten die Pagination stabil.
 */

export interface GalleryColumnSortSpec {
  /** Feldname ohne Pfad-Präfix (bereits validiert). */
  field: string
  dir: 1 | -1
  /** number-Facette: Wert wird per $convert nach double gewandelt (Fehler -> leer). */
  numeric: boolean
  /**
   * Wo das Feld lebt: 'top' = Top-Level (title, upsertedAt),
   * 'meta' = docMetaJson mit Top-Level-Fallback (Facetten),
   * 'favorites' = per $lookup berechnetes favoriteCount.
   */
  source: 'top' | 'meta' | 'favorites'
}

export interface FacetDefLike {
  metaKey: string
  type?: string
}

export type ColumnSortResolution =
  | { ok: true; spec: GalleryColumnSortSpec }
  | { ok: false; status: 400 | 403; error: string }

function isNumericFacetType(type: string | undefined): boolean {
  return type === 'number' || type === 'integer-range'
}

/**
 * Validiert die Query-Params der Spalten-Sortierung. `null` = keine
 * Spalten-Sortierung angefragt. Ungültige/unbekannte Felder werden explizit
 * abgelehnt (kein Silent Fallback auf den Default-Sort).
 */
export function resolveColumnSort(
  sortFieldRaw: string | null,
  sortDirRaw: string | null,
  defs: FacetDefLike[],
  isMember: boolean,
): ColumnSortResolution | null {
  if (!sortFieldRaw && !sortDirRaw) return null
  if (!sortFieldRaw || !sortDirRaw) {
    return { ok: false, status: 400, error: 'sortField und sortDir müssen gemeinsam gesetzt sein' }
  }
  if (sortDirRaw !== 'asc' && sortDirRaw !== 'desc') {
    return { ok: false, status: 400, error: `Ungültige sortDir: ${sortDirRaw}` }
  }
  const dir: 1 | -1 = sortDirRaw === 'asc' ? 1 : -1

  if (sortFieldRaw === 'title' || sortFieldRaw === 'upsertedAt') {
    return { ok: true, spec: { field: sortFieldRaw, dir, numeric: false, source: 'top' } }
  }
  if (sortFieldRaw === 'favoriteCount') {
    if (!isMember) {
      return { ok: false, status: 403, error: 'Sortierung nach Sternen ist Mitgliedern vorbehalten' }
    }
    return { ok: true, spec: { field: 'favoriteCount', dir, numeric: true, source: 'favorites' } }
  }
  // Persistierter Prio-Indikator (climateAction) — Spalte existiert auch ohne Facette.
  if (sortFieldRaw === 'prioritaets_index') {
    return { ok: true, spec: { field: 'prioritaets_index', dir, numeric: true, source: 'meta' } }
  }
  const def = defs.find((d) => d.metaKey === sortFieldRaw)
  if (!def) {
    return { ok: false, status: 400, error: `Unbekanntes Sortierfeld: ${sortFieldRaw}` }
  }
  return {
    ok: true,
    spec: { field: def.metaKey, dir, numeric: isNumericFacetType(def.type), source: 'meta' },
  }
}

/**
 * Baut die Aggregation-Stages für die Spalten-Sortierung (vor $skip/$limit):
 *  1. `__sortValue`: normalisierter Vergleichswert (numeric: $convert; string: $toLower)
 *  2. `__sortEmpty`: 1 wenn null/'' — sortiert IMMER ans Ende (0 zählt als Wert!)
 *  3. `$sort` mit stabilen Sekundärschlüsseln für die Pagination.
 * `__sortValue/__sortEmpty` verschwinden durch die Inclusion-Projection des Repos.
 */
export function buildColumnSortStages(spec: GalleryColumnSortSpec): Array<Record<string, unknown>> {
  const raw =
    spec.source === 'top'
      ? { $ifNull: [`$${spec.field}`, null] }
      : spec.source === 'favorites'
        ? { $ifNull: ['$favoriteCount', null] }
        : { $ifNull: [`$docMetaJson.${spec.field}`, { $ifNull: [`$${spec.field}`, null] }] }

  // $toLower nur auf Strings (Arrays/Zahlen unverändert, sonst Aggregation-Fehler);
  // number-Facetten: als String gespeicherte Zahlen mitkonvertieren, Müll -> leer.
  const value = spec.numeric
    ? { $convert: { input: raw, to: 'double', onError: null, onNull: null } }
    : { $cond: [{ $eq: [{ $type: raw }, 'string'] }, { $toLower: raw }, raw] }

  return [
    { $addFields: { __sortValue: value } },
    {
      $addFields: {
        __sortEmpty: {
          $cond: [{ $or: [{ $eq: ['$__sortValue', null] }, { $eq: ['$__sortValue', ''] }] }, 1, 0],
        },
      },
    },
    { $sort: { __sortEmpty: 1, __sortValue: spec.dir, year: -1, upsertedAt: -1, _id: 1 } },
  ]
}
