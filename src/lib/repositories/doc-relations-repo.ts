/**
 * @fileoverview Doc-Relations Repository (MongoDB) — Quelle A des Graph-Modus.
 *
 * @description
 * Speichert die BERECHNETEN, gerichteten, gewichteten „Supports"-Kanten einer
 * Library (Zielbild §5.4). Eine Per-Library-Collection `doc_relations__<libraryId>`
 * konsistent zum Muster `doc_meta__<libraryId>` / `vectors__<libraryId>`
 * (siehe `docs/architecture/mongodb-repository-pattern.md`).
 *
 * Schlüssel ist die STABILE `fileId` (nicht slug/nr) — überlebt Reslug/Reindex.
 * Jede Maßnahme „besitzt" ihre AUSGEHENDEN Kanten (`sourceFileId`); „eingehend"
 * wird per Query auf `targetFileId` abgeleitet, nicht doppelt gespeichert.
 *
 * Replace-Semantik (Zielbild §5.5):
 *  - eine Maßnahme  → `replaceEdgesForSource` (deleteMany + insertMany)
 *  - ganze Library → `replaceAllEdgesForLibrary`
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

/** Eine gerichtete, gewichtete Beziehungs-Kante A → B (Zielbild §5.4). */
export interface DocRelationEdge {
  _id?: string
  libraryId: string
  /** STABILER Schlüssel der Quell-Maßnahme (nicht slug/nr). */
  sourceFileId: string
  /** STABILER Schlüssel der Ziel-Maßnahme. */
  targetFileId: string
  /** Denormalisiert, nur für Anzeige/Debug. */
  sourceSlug?: string
  targetSlug?: string
  /** Stärke der Abhängigkeit `0..1`. */
  weight: number
  /** Kurze Begründung der Kante (LLM). */
  rationale?: string
  /** Generischer Beziehungstyp, Default „unterstuetzt". */
  relationType: string
  /** Zeitpunkt der Berechnung (Audit + Staleness). */
  computedAt: Date
  /** Modell/User der Berechnung (Audit). */
  computedBy: string
  /**
   * Hash über den Katalog-Stand zum Berechnungszeitpunkt (Staleness, §5.5).
   * Denormalisiert auf jede Kante, damit die GET-Route ohne Zusatz-Doc auf
   * „veraltet?" prüfen kann (jüngste Kante zählt).
   */
  catalogHash?: string
}

const collectionCache = new Map<string, Collection<DocRelationEdge>>()
const indexCache = new Set<string>()

export function getDocRelationsCollectionName(libraryId: string): string {
  return `doc_relations__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<DocRelationEdge>> {
  const name = getDocRelationsCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<DocRelationEdge>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(libraryId: string): Promise<void> {
  const name = getDocRelationsCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await Promise.all([
    col.createIndex({ libraryId: 1, sourceFileId: 1 }),
    col.createIndex({ libraryId: 1, targetFileId: 1 }),
    col.createIndex({ libraryId: 1, computedAt: -1 }),
    col.createIndex({ libraryId: 1, sourceFileId: 1, weight: -1 }),
  ])
  indexCache.add(name)
}

/**
 * Lädt die Kanten einer Library. Optional auf eine sichtbare (gefilterte)
 * Knotenmenge begrenzt: nur Kanten, deren BEIDE Endpunkte in `fileIds` liegen
 * (Kanten zwischen ausgefilterten Knoten werden nicht gezeigt, §6.4).
 */
export async function getDocRelations(
  libraryId: string,
  fileIds?: string[],
): Promise<DocRelationEdge[]> {
  const col = await getCol(libraryId)
  const query: Record<string, unknown> = { libraryId }
  if (fileIds && fileIds.length > 0) {
    const inSet = { $in: fileIds }
    query.sourceFileId = inSet
    query.targetFileId = inSet
  }
  return col.find(query, { projection: { _id: 0 } }).toArray()
}

/** Liefert den Katalog-Hash der jüngsten Berechnung (für Staleness-Vergleich). */
export async function getLatestCatalogHash(libraryId: string): Promise<{
  catalogHash: string | null
  computedAt: Date | null
}> {
  const col = await getCol(libraryId)
  const latest = await col
    .find({ libraryId }, { projection: { _id: 0, catalogHash: 1, computedAt: 1 } })
    .sort({ computedAt: -1 })
    .limit(1)
    .next()
  return {
    catalogHash: typeof latest?.catalogHash === 'string' ? latest.catalogHash : null,
    computedAt: latest?.computedAt instanceof Date ? latest.computedAt : null,
  }
}

/**
 * Ersetzt die ausgehenden Kanten EINER Quell-Maßnahme atomar (Zielbild §5.5a):
 * `deleteMany({libraryId, sourceFileId})` + `insertMany`.
 */
export async function replaceEdgesForSource(
  libraryId: string,
  sourceFileId: string,
  edges: DocRelationEdge[],
): Promise<{ deleted: number; inserted: number }> {
  await ensureIndexes(libraryId)
  const col = await getCol(libraryId)
  const del = await col.deleteMany({ libraryId, sourceFileId })
  if (edges.length === 0) return { deleted: del.deletedCount ?? 0, inserted: 0 }
  const res = await col.insertMany(edges)
  return { deleted: del.deletedCount ?? 0, inserted: res.insertedCount ?? 0 }
}

/**
 * Ersetzt ALLE Kanten einer Library atomar (Zielbild §5.5b):
 * `deleteMany({libraryId})` + `insertMany`.
 */
export async function replaceAllEdgesForLibrary(
  libraryId: string,
  edges: DocRelationEdge[],
): Promise<{ deleted: number; inserted: number }> {
  await ensureIndexes(libraryId)
  const col = await getCol(libraryId)
  const del = await col.deleteMany({ libraryId })
  if (edges.length === 0) return { deleted: del.deletedCount ?? 0, inserted: 0 }
  const res = await col.insertMany(edges)
  return { deleted: del.deletedCount ?? 0, inserted: res.insertedCount ?? 0 }
}
