/**
 * @fileoverview Persistenz der Aehnlichkeits-Nachbarn (Graph-Quelle C, Stufe 4c
 * — Plan summen-und-synergie-aggregation, Todo similarity-persist).
 *
 * @description
 * DETERMINISTISCH (kein LLM): rechnet je Dokument die Top-K semantischen
 * Nachbarn per Vector-Suche und schreibt sie flach nach
 * `docMetaJson.similarity_neighbors` (+ `similarity_stand`). Der Graph baut die
 * Similarity-Kanten danach OHNE Live-Vector-Suche aus den geladenen Docs — das
 * beseitigt die 606-Live-Suchen-pro-Oeffnen (RAM-gebundener M10, Befund
 * 2026-07-09).
 *
 * Der Lauf ist teuer (1 Vector-Suche pro Doc) und laeuft daher als
 * external-job (`phase-doc-similarity`), NICHT synchron in der Route.
 *
 * no-silent-fallbacks: Docs ohne Embedding werden als `missingEmbeddings`
 * gezaehlt (nicht still uebersprungen); einzelne fehlgeschlagene Suchen als
 * `failedSeeds`. Schlagen ALLE fehl, wirft der Lauf.
 *
 * @usedIn
 * - src/lib/external-jobs/phase-doc-similarity.ts
 */

import { getCollectionNameForLibrary, getCollectionOnly, queryDocuments } from '@/lib/repositories/vector-repo'
import type { AnyBulkWriteOperation, Document } from 'mongodb'
import type { Library } from '@/types/library'

/** Nachbarn je Doc (aus `edgeSources.similarity.topK`, Default 6). */
const DEFAULT_TOP_K = 6
const MAX_TOP_K = 30
/** Seeds pro Batch (Embeddings-Ladung + Schreib-BulkWrite). */
const SEED_BATCH = 200
/**
 * Parallele Vector-Suchen. BEWUSST 1 (sequenziell): auf einem RAM-gebundenen
 * Cluster (Prod M10, 2 GB, 2048-dim-Indizes) konkurrieren mehrere gleichzeitige
 * Vector-Suchen um denselben HNSW-Index-Cache und laufen ALLE in den Timeout
 * (Befund 2026-07-09: Concurrency 4 → Masse "operation exceeded time limit").
 * Sequenziell haelt den Index warm (gemessen: erste Suche ~7 s kalt, danach
 * ~0,5 s) — langsamer, aber vollstaendig und ohne den Cluster lahmzulegen.
 */
const SEARCH_CONCURRENCY = 1
/** Hartes Zeitlimit pro Vector-Suche (kalte M10-Suche kann >15 s brauchen). */
const SEARCH_MAX_TIME_MS = 30000

export interface SimilarityPersistResult {
  processed: number
  missingEmbeddings: number
  failedSeeds: number
  topK: number
  stand: string
}

/** Fuehrt `fn` ueber `items` mit begrenzter Nebenlaeufigkeit aus. */
async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/** Liest die konfigurierte Nachbar-Anzahl (topK) aus der Library-Config. */
function resolveTopK(library: Library): number {
  const raw = library.config?.chat?.gallery?.graph?.edgeSources?.similarity?.topK
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_TOP_K
  return Math.min(MAX_TOP_K, Math.max(1, n))
}

/**
 * Rechnet die Top-K-Nachbarn fuer den GESAMTEN Bestand und persistiert sie je
 * Doc. `onProgress` erlaubt der Phase, Fortschritt zu tracen.
 */
export async function computeAndStoreSimilarityNeighbors(
  library: Library,
  libraryId: string,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<SimilarityPersistResult> {
  const libraryKey = getCollectionNameForLibrary(library)
  const col = await getCollectionOnly(libraryKey)
  const topK = resolveTopK(library)
  const stand = new Date().toISOString()

  // Alle Seed-fileIds laden (nur fileId — Embeddings kommen batchweise).
  const idRows = await col
    .find({ kind: 'meta', libraryId } as unknown as Document, { projection: { _id: 0, fileId: 1 } })
    .toArray()
  const allFileIds = idRows
    .map((r) => (typeof r.fileId === 'string' ? r.fileId : ''))
    .filter((s): s is string => s.length > 0)

  let processed = 0
  let missingEmbeddings = 0
  let failedSeeds = 0
  let seedsWithEmbeddingTotal = 0

  for (let offset = 0; offset < allFileIds.length; offset += SEED_BATCH) {
    const batch = allFileIds.slice(offset, offset + SEED_BATCH)

    // Embeddings dieser Batch laden (Meta-_id-Schema: `${fileId}-meta`).
    const metaRows = await col
      .find(
        { _id: { $in: batch.map((id) => `${id}-meta`) }, kind: 'meta' } as unknown as Document,
        { projection: { _id: 0, fileId: 1, embedding: 1 } },
      )
      .toArray()
    const embByFileId = new Map<string, number[]>()
    for (const row of metaRows) {
      const fid = typeof row.fileId === 'string' ? row.fileId : ''
      const emb = Array.isArray(row.embedding) ? (row.embedding as number[]) : null
      if (fid && emb && emb.length > 0) embByFileId.set(fid, emb)
    }
    missingEmbeddings += batch.filter((id) => !embByFileId.has(id)).length
    const seedsWithEmbedding = batch.filter((id) => embByFileId.has(id))
    seedsWithEmbeddingTotal += seedsWithEmbedding.length

    // Ueberfetchen, damit nach Self-Filterung genug Nachbarn bleiben.
    const overFetch = Math.min(topK + 5, 200)
    const neighborsByFileId = new Map<string, Array<{ fileId: string; weight: number }>>()

    await mapWithConcurrency(seedsWithEmbedding, SEARCH_CONCURRENCY, async (seedId) => {
      const embedding = embByFileId.get(seedId)
      if (!embedding) return
      let matches
      try {
        matches = await queryDocuments(libraryKey, embedding, overFetch, {}, embedding.length, library, {
          maxTimeMS: SEARCH_MAX_TIME_MS,
        })
      } catch (err) {
        failedSeeds++
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[similarity-persist] Vector-Suche fehlgeschlagen (Seed ${seedId}):`, msg)
        return
      }
      const neighbors: Array<{ fileId: string; weight: number }> = []
      for (const match of matches) {
        if (neighbors.length >= topK) break
        const neighbor = typeof match.metadata.fileId === 'string' ? match.metadata.fileId : ''
        if (!neighbor || neighbor === seedId) continue // Self-Exclusion
        neighbors.push({ fileId: neighbor, weight: typeof match.score === 'number' ? match.score : 0 })
      }
      neighborsByFileId.set(seedId, neighbors)
    })

    // Persistieren: pro Seed die Nachbarliste + Stand (BulkWrite, ein Round-Trip).
    const ops: AnyBulkWriteOperation<Document>[] = []
    for (const [fileId, neighbors] of neighborsByFileId) {
      ops.push({
        updateOne: {
          filter: { _id: `${fileId}-meta`, kind: 'meta' } as unknown as Document,
          update: { $set: { 'docMetaJson.similarity_neighbors': neighbors, 'docMetaJson.similarity_stand': stand } },
        },
      })
    }
    if (ops.length > 0) {
      const res = await col.bulkWrite(ops, { ordered: false })
      processed += res.modifiedCount ?? ops.length
    }
    if (onProgress) await onProgress(Math.min(offset + SEED_BATCH, allFileIds.length), allFileIds.length)
  }

  // Kein silent fallback: wenn ueberhaupt Embeddings da waren, aber ALLE Suchen scheitern.
  if (seedsWithEmbeddingTotal > 0 && failedSeeds === seedsWithEmbeddingTotal) {
    throw new Error('Alle Nachbar-Suchen fehlgeschlagen — Datenbank ueberlastet oder Vector-Index nicht erreichbar')
  }

  return { processed, missingEmbeddings, failedSeeds, topK, stand }
}
