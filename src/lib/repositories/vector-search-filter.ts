/**
 * Uebersetzt einen Chunk-Filter in die Form, die der `filter` von
 * `$vectorSearch` (MongoDB Atlas) versteht. Reine Funktion, aus
 * `queryVectors` (vector-repo.ts) herausgezogen — Befund 05.11.2026: der
 * Draft-Ausschluss fuer Gaeste (`fileId: { $nin: [...] }`,
 * publication-filter.ts) wurde in `{ $eq: { $nin: [...] } }` gepackt, und
 * Atlas antwortete „filter.fileId.$eq must be a boolean, objectId, …" —
 * jede anonyme Frage an eine Library mit Entwuerfen scheiterte.
 *
 * Regeln:
 * - Operator-Objekte (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`,
 *   `$nin`) gehen unveraendert durch.
 * - Arrays werden zu `$in`, direkte Werte zu `$eq`.
 * - `null`/`undefined` werden ausgelassen.
 * - Ein Objekt mit unbekanntem `$`-Operator wirft (kein stilles `$eq`).
 */

/** Operatoren, die Atlas Vector Search im `filter` kennt (ohne `$and`/`$or`, die hier nicht gebaut werden). */
export const VECTOR_SEARCH_OPERATOREN: ReadonlySet<string> = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'])

function istObjekt(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Objekt, dessen Schluessel allesamt bekannte Vektorsuch-Operatoren sind. */
export function istOperatorAusdruck(value: unknown): value is Record<string, unknown> {
  if (!istObjekt(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((k) => VECTOR_SEARCH_OPERATOREN.has(k))
}

export interface VectorSearchFilterErgebnis {
  filter: Record<string, unknown>
  /** Felder mit `$in`/`$nin`, die einen Token-Index brauchen (Warnung im Aufrufer). */
  arrayFieldsInFilter: string[]
}

export function vectorSearchFilterAus(
  restFilter: Record<string, unknown>,
  requiresTokenIndex: (key: string) => boolean,
): VectorSearchFilterErgebnis {
  const filter: Record<string, unknown> = {}
  const arrayFieldsInFilter: string[] = []
  for (const [key, value] of Object.entries(restFilter)) {
    if (value === null || value === undefined) continue
    if (istOperatorAusdruck(value)) {
      filter[key] = value
      if (('$in' in value || '$nin' in value) && requiresTokenIndex(key)) arrayFieldsInFilter.push(key)
    } else if (Array.isArray(value)) {
      filter[key] = { $in: value }
      if (requiresTokenIndex(key)) arrayFieldsInFilter.push(key)
    } else if (istObjekt(value) && Object.keys(value).some((k) => k.startsWith('$'))) {
      throw new Error(
        `Vector-Search-Filter "${key}": Operator ${Object.keys(value).join(', ')} wird nicht unterstuetzt (erlaubt: ${[...VECTOR_SEARCH_OPERATOREN].join(', ')})`,
      )
    } else {
      filter[key] = { $eq: value }
    }
  }
  return { filter, arrayFieldsInFilter }
}
