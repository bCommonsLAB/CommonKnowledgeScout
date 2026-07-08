/**
 * doc-neighbors-service — Berechnung der Ähnlichkeits-Kanten (Quelle C des
 * Graph-Modus) aus den Dokument-Embeddings.
 *
 * Ausgelagert aus `api/chat/[libraryId]/doc-neighbors/route.ts` (200-Zeilen-
 * Regel). Die Route macht Auth + Parsing, dieser Service rechnet.
 *
 * Skalierungs-Verhalten (Befund 2026-07-08, 606 Docs gegen Prod-Atlas):
 * - Seeds pro Aufruf hart auf `MAX_NODES` gedeckelt; grosse Bibliotheken
 *   werden vom Client (use-similarity-edges) in Chunks angefragt. Damit die
 *   Kanten dabei ueber ALLE sichtbaren Knoten gehen duerfen (nicht nur den
 *   aktuellen Chunk), nimmt der Service optional `neighborScope` entgegen.
 * - Jede Vector-Suche laeuft mit `SEARCH_MAX_TIME_MS`, damit eine haengende
 *   Aggregation keine Pool-Connection minutenlang blockiert.
 * - Einzelne fehlgeschlagene Suchen brechen NICHT den ganzen Request ab;
 *   sie werden gezaehlt und als `failedSeeds` gemeldet (kein silent
 *   fallback). Schlagen ALLE Suchen fehl, wirft der Service.
 */

import { getCollectionNameForLibrary, getCollectionOnly, queryDocuments } from '@/lib/repositories/vector-repo'
import type { Document } from 'mongodb'
import type { Library } from '@/types/library'

/** Obergrenze der pro Request verarbeiteten Seed-Knoten (Hairball-/Kostenschutz). */
export const MAX_NODES = 200
/** Obergrenze fuer die erlaubte Nachbar-Menge (`neighborScope`) pro Request. */
export const MAX_SCOPE = 5000
/** Parallel laufende Vector-Search-Aufrufe. */
const SEARCH_CONCURRENCY = 6
/** Hartes Zeitlimit pro Vector-Suche (haengende Aggregation ≠ blockierter Pool). */
const SEARCH_MAX_TIME_MS = 15000
const DEFAULT_TOP_K = 6
const MAX_TOP_K = 30

/** Führt `fn` über `items` mit begrenzter Nebenläufigkeit aus. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export interface NeighborsPayload {
  edges: Array<{ source: string; target: string; weight: number }>
  nodeCount: number
  processedNodes: number
  missingEmbeddings: number
  /** Anzahl Seeds, deren Vector-Suche fehlgeschlagen ist (z. B. DB-Timeout). */
  failedSeeds: number
  truncated: boolean
}

/**
 * Berechnet die Ähnlichkeits-Kanten für die übergebene Knotenmenge.
 *
 * @param fileIdsInput Seeds — für diese Knoten werden Nachbarn gesucht.
 * @param neighborScopeInput Optional: erlaubte Nachbar-Menge (kompletter
 *   sichtbarer Bestand beim Chunking). Ohne Angabe gelten die Seeds selbst.
 */
export async function buildNeighborsPayload(
  library: Library,
  fileIdsInput: string[],
  topKInput: number,
  neighborScopeInput?: string[],
): Promise<NeighborsPayload> {
  const fileIds = [...new Set(fileIdsInput.map((s) => s.trim()).filter(Boolean))]
  const topK = Number.isFinite(topKInput) && topKInput > 0 ? Math.min(topKInput, MAX_TOP_K) : DEFAULT_TOP_K

  const truncated = fileIds.length > MAX_NODES
  const seeds = truncated ? fileIds.slice(0, MAX_NODES) : fileIds
  const scope = neighborScopeInput && neighborScopeInput.length > 0
    ? [...new Set(neighborScopeInput.map((s) => s.trim()).filter(Boolean))]
    : null

  const libraryKey = getCollectionNameForLibrary(library)
  const col = await getCollectionOnly(libraryKey)

  // Embeddings der Seeds laden (eine Query, kein N+1). Meta-_id-Schema: `${fileId}-meta`.
  const metaRows = await col
    .find(
      { _id: { $in: seeds.map((id) => `${id}-meta`) }, kind: 'meta' } as unknown as Document,
      { projection: { _id: 0, fileId: 1, embedding: 1 } },
    )
    .toArray()

  const embByFileId = new Map<string, number[]>()
  for (const row of metaRows) {
    const fid = typeof row.fileId === 'string' ? row.fileId : ''
    const emb = Array.isArray(row.embedding) ? (row.embedding as number[]) : null
    if (fid && emb && emb.length > 0) embByFileId.set(fid, emb)
  }

  // Erlaubte Nachbarn: kompletter Scope (Chunking) oder die Seeds selbst.
  const requested = new Set(scope ?? seeds)
  const missingEmbeddings = seeds.filter((id) => !embByFileId.has(id))
  const seedsWithEmbedding = seeds.filter((id) => embByFileId.has(id))

  // Überfetchen, damit nach Self-/Out-of-Set-Filterung genug In-Set-Nachbarn übrig bleiben.
  const overFetch = Math.min(Math.max((topK + 1) * 4, topK + 5), 200)

  // Ungerichtete, gewichtete Kanten: pro Paar das stärkste Gewicht (Score) behalten.
  const pairWeight = new Map<string, number>()
  let failedSeeds = 0
  await mapWithConcurrency(seedsWithEmbedding, SEARCH_CONCURRENCY, async (seedId) => {
    const embedding = embByFileId.get(seedId)
    if (!embedding) return
    let matches
    try {
      matches = await queryDocuments(libraryKey, embedding, overFetch, {}, embedding.length, library, {
        maxTimeMS: SEARCH_MAX_TIME_MS,
      })
    } catch (err) {
      // Einzelne Timeouts/Fehler tolerieren, aber sichtbar machen (failedSeeds).
      failedSeeds++
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[doc-neighbors] Vector-Suche fehlgeschlagen (Seed ${seedId}):`, msg)
      return
    }
    let kept = 0
    for (const match of matches) {
      if (kept >= topK) break
      const neighbor = typeof match.metadata.fileId === 'string' ? match.metadata.fileId : ''
      if (!neighbor || neighbor === seedId) continue // Self-Exclusion
      if (!requested.has(neighbor)) continue // nur Kanten zwischen sichtbaren Knoten
      kept++
      const [a, b] = seedId < neighbor ? [seedId, neighbor] : [neighbor, seedId]
      const key = `${a}|${b}`
      const weight = typeof match.score === 'number' ? match.score : 0
      const prev = pairWeight.get(key)
      if (prev === undefined || weight > prev) pairWeight.set(key, weight)
    }
  })

  // Kein silent fallback: wenn ALLE Suchen scheitern, ist das ein Fehler.
  if (seedsWithEmbedding.length > 0 && failedSeeds === seedsWithEmbedding.length) {
    throw new Error('Alle Nachbar-Suchen fehlgeschlagen — Datenbank überlastet oder Vector-Index nicht erreichbar')
  }

  const edges = [...pairWeight.entries()].map(([key, weight]) => {
    const [source, target] = key.split('|')
    return { source, target, weight }
  })

  return {
    edges,
    nodeCount: seeds.length,
    processedNodes: seedsWithEmbedding.length,
    missingEmbeddings: missingEmbeddings.length,
    failedSeeds,
    truncated,
  }
}
