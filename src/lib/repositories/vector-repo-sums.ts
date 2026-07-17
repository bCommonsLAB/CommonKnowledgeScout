/**
 * @fileoverview Summen-Aggregation ueber Galerie-Meta-Dokumente.
 *
 * @description
 * Aggregiert additive Zahlenfelder (Positivliste aus der DetailViewType-
 * Registry, z.B. co2_einsparung_kt/kosten_eur) serverseitig ueber den
 * GESAMTEN gefilterten Bestand — die Galerie-Liste laedt paginiert, eine
 * Client-Summe ueber geladene Zeilen waere still falsch.
 *
 * no-silent-fallbacks: fehlende oder nicht-numerische Werte werden NICHT als 0
 * gezaehlt, sondern pro Feld explizit als `missing` gemeldet ("X ohne Angabe").
 * Werte koennen in Mongo als number ODER string liegen (vgl. massnahme_nr-Fix
 * in doc-meta-mappers, 2026-07-08) — $convert deckt beide Pfade ab; nicht
 * parsebare Strings zaehlen als missing, nicht als 0.
 *
 * @usedIn
 * - src/app/api/chat/[libraryId]/docs/route.ts (?aggregate=sums)
 */

import type { Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

/** Aggregat eines einzelnen Summenfeldes. */
export interface FieldSumAggregate {
  /** Summe ueber alle Dokumente mit numerischem Wert. */
  sum: number
  /** Anzahl Dokumente, die in die Summe eingeflossen sind. */
  count: number
  /** Anzahl Dokumente OHNE verwertbaren Zahlenwert ("X ohne Angabe"). */
  missing: number
}

export interface DocFieldSumsResult {
  /** Gesamtzahl der Dokumente im gefilterten Bestand. */
  total: number
  /** Aggregat pro angefragtem Feld. */
  sums: Record<string, FieldSumAggregate>
}

/**
 * Berechnet pro Feld { sum, count, missing } ueber alle Meta-Dokumente, die
 * dem uebergebenen (bereits fertig gebauten) Galerie-Filter entsprechen.
 * Ein einziger $group-Lauf fuer alle Felder — kein $facet noetig.
 */
export async function aggregateDocFieldSums(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  fields: string[],
): Promise<DocFieldSumsResult> {
  if (fields.length === 0) {
    throw new Error('aggregateDocFieldSums: fields darf nicht leer sein')
  }
  const col = await getCollection<Document>(libraryKey)

  const groupStage: Document = { _id: null, __total: { $sum: 1 } }
  for (const field of fields) {
    // Wert kann top-level oder in docMetaJson liegen; number oder string.
    // onError/onNull -> null = "kein verwertbarer Wert" (zaehlt als missing).
    const numExpr: Document = {
      $convert: {
        input: { $ifNull: [`$docMetaJson.${field}`, `$${field}`] },
        to: 'double',
        onError: null,
        onNull: null,
      },
    }
    groupStage[`${field}__sum`] = { $sum: { $ifNull: [numExpr, 0] } }
    groupStage[`${field}__count`] = { $sum: { $cond: [{ $eq: [numExpr, null] }, 0, 1] } }
  }

  const pipeline: Document[] = [
    { $match: { kind: 'meta', libraryId, ...filter } },
    { $group: groupStage },
  ]
  const rows = await col.aggregate(pipeline).toArray()

  // Leerer Bestand: $group liefert keine Zeile -> alles 0 (kein Fehlerfall).
  const row = rows[0] as Record<string, unknown> | undefined
  const total = typeof row?.__total === 'number' ? row.__total : 0

  const sums: Record<string, FieldSumAggregate> = {}
  for (const field of fields) {
    const sum = row?.[`${field}__sum`]
    const count = row?.[`${field}__count`]
    if (row && (typeof sum !== 'number' || typeof count !== 'number')) {
      throw new Error(`aggregateDocFieldSums: unerwartetes Aggregat fuer Feld "${field}"`)
    }
    const countNum = typeof count === 'number' ? count : 0
    sums[field] = {
      sum: typeof sum === 'number' ? sum : 0,
      count: countNum,
      missing: total - countNum,
    }
  }
  return { total, sums }
}
