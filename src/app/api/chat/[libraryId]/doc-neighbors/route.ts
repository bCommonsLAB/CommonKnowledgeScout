import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, getCollectionOnly, queryDocuments } from '@/lib/repositories/vector-repo'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import type { Document } from 'mongodb'
import type { Library } from '@/types/library'

/**
 * GET/POST /api/chat/[libraryId]/doc-neighbors — Quelle C des Graph-Modus
 * ("semantische Nachbarn", Zielbild §5.3).
 *
 * Baut die Ähnlichkeits-Kanten zwischen den ÜBERGEBENEN, bereits gefilterten
 * Dokumenten (`fileIds`) aus den vorhandenen Dokument-Embeddings. Für jedes
 * Seed-Dokument werden via `vector-repo.queryDocuments` (Atlas Vector Search,
 * kind: 'meta') die nächsten Nachbarn gesucht; gehalten werden nur Nachbarn,
 * die ebenfalls in der sichtbaren Menge liegen (= aktive Filter respektiert,
 * weil `fileIds` der gefilterte Galerie-Bestand ist) und NICHT das Seed selbst
 * (Self-Exclusion). Kein LLM, kein Schreibvorgang — rein abgeleitet.
 *
 * fileIds-Übergabe: GET nimmt sie als Query-Parameter (kleine Mengen), POST im
 * JSON-Body (`{ fileIds, topK }`). Bei großen Bibliotheken (Hunderte Knoten)
 * überschreitet die GET-URL die Header-Grenze des Servers (HTTP 431) — daher
 * nutzt der Graph-Client POST.
 *
 * Performance/Scoping:
 *  - Per-Library-Collection → keine `libraryId`-Filterung im Vektor-Query nötig.
 *  - Seed-Anzahl hart gedeckelt (`MAX_NODES`), Suche nebenläufig begrenzt.
 *  - Kein Silent Fallback: fehlende `fileIds` → 400; Dokumente ohne Embedding
 *    werden gezählt und im Response gemeldet (`missingEmbeddings`).
 */

/** Obergrenze der pro Request verarbeiteten Seed-Knoten (Hairball-/Kostenschutz). */
const MAX_NODES = 200
/** Parallel laufende Vector-Search-Aufrufe. */
const SEARCH_CONCURRENCY = 6
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

/** Auth + Library-Kontext (öffentliche Libraries dürfen anonym lesen). */
async function resolveContext(
  libraryId: string,
): Promise<{ ok: true; library: Library } | { ok: false; res: NextResponse }> {
  let userId: string | null = null
  let userEmail = ''
  try {
    const authResult = await auth()
    userId = authResult.userId || null
    if (userId) {
      const user = await currentUser()
      userEmail = getPreferredUserEmail(user)
    }
  } catch (authError) {
    const isRateLimit = authError && typeof authError === 'object' && 'status' in authError && authError.status === 429
    if (isRateLimit) {
      console.warn('[API] Clerk Rate Limit bei doc-neighbors, versuche ohne Auth fortzufahren')
    } else {
      throw authError
    }
  }

  const ctx = await loadLibraryChatContext(userEmail, libraryId)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }
  if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
    return { ok: false, res: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }
  }
  return { ok: true, library: ctx.library }
}

/** Berechnet die Ähnlichkeits-Kanten für die übergebene Knotenmenge. */
async function buildNeighborsPayload(
  library: Library,
  fileIdsInput: string[],
  topKInput: number,
): Promise<Record<string, unknown>> {
  const fileIds = [...new Set(fileIdsInput.map((s) => s.trim()).filter(Boolean))]
  const topK = Number.isFinite(topKInput) && topKInput > 0 ? Math.min(topKInput, MAX_TOP_K) : DEFAULT_TOP_K

  const truncated = fileIds.length > MAX_NODES
  const seeds = truncated ? fileIds.slice(0, MAX_NODES) : fileIds

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

  const requested = new Set(seeds)
  const missingEmbeddings = seeds.filter((id) => !embByFileId.has(id))
  const seedsWithEmbedding = seeds.filter((id) => embByFileId.has(id))

  // Überfetchen, damit nach Self-/Out-of-Set-Filterung genug In-Set-Nachbarn übrig bleiben.
  const overFetch = Math.min(Math.max((topK + 1) * 4, topK + 5), 200)

  // Ungerichtete, gewichtete Kanten: pro Paar das stärkste Gewicht (Score) behalten.
  const pairWeight = new Map<string, number>()
  await mapWithConcurrency(seedsWithEmbedding, SEARCH_CONCURRENCY, async (seedId) => {
    const embedding = embByFileId.get(seedId)
    if (!embedding) return
    const matches = await queryDocuments(libraryKey, embedding, overFetch, {}, embedding.length, library)
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

  const edges = [...pairWeight.entries()].map(([key, weight]) => {
    const [source, target] = key.split('|')
    return { source, target, weight }
  })

  return {
    edges,
    nodeCount: seeds.length,
    processedNodes: seedsWithEmbedding.length,
    missingEmbeddings: missingEmbeddings.length,
    truncated,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    const resolved = await resolveContext(libraryId)
    if (!resolved.ok) return resolved.res

    const url = new URL(req.url)
    const fileIds = (url.searchParams.get('fileIds') || '').split(',')
    const cleaned = fileIds.map((s) => s.trim()).filter(Boolean)
    if (cleaned.length === 0) return NextResponse.json({ error: 'Parameter fileIds fehlt' }, { status: 400 })
    const topK = parseInt(url.searchParams.get('topK') || '', 10)

    const payload = await buildNeighborsPayload(resolved.library, cleaned, topK)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    const resolved = await resolveContext(libraryId)
    if (!resolved.ok) return resolved.res

    const body = (await req.json().catch(() => ({}))) as { fileIds?: unknown; topK?: unknown }
    const rawIds = Array.isArray(body.fileIds) ? body.fileIds : []
    const cleaned = rawIds.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
    if (cleaned.length === 0) return NextResponse.json({ error: 'fileIds fehlt (Array im Body)' }, { status: 400 })
    const topK = typeof body.topK === 'number' ? body.topK : NaN

    const payload = await buildNeighborsPayload(resolved.library, cleaned, topK)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
