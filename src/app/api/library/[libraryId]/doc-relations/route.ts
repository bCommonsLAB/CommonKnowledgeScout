import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { getCollectionNameForLibrary, findDocs } from '@/lib/repositories/vector-repo'
import { getDocRelations, getLatestCatalogHash } from '@/lib/repositories/doc-relations-repo'
import { computeCatalogHash } from '@/lib/gallery/relations-staleness'
import type { Library } from '@/types/library'

/**
 * GET/POST /api/library/[libraryId]/doc-relations — Quelle A des Graph-Modus
 * (berechnete, gerichtete, gewichtete „Supports"-Kanten, Zielbild §5.4).
 *
 * Lädt die vorberechneten Kanten aus `doc_relations__<libraryId>` und meldet
 * über einen Katalog-Hash, ob sie VERALTET sind. Öffentlich lesbar (wie die
 * docs-Route); Neuberechnen bleibt Owner/Co-Creator (eigene recompute-Route).
 *
 * Optionaler `fileIds`-Parameter scoped die Kanten auf die sichtbare
 * (gefilterte) Galerie-Menge. Übergabe: GET als Query-Parameter (kleine Mengen),
 * POST im JSON-Body (`{ fileIds }`). Bei großen Bibliotheken (Hunderte Knoten)
 * überschreitet die GET-URL die Header-Grenze des Servers (HTTP 431) — daher
 * nutzt der Graph-Client POST.
 *
 * Kein Silent Fallback: fehlende Library → 404; nicht-öffentlich + anonym → 401.
 */

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
    if (!isRateLimit) throw authError
    console.warn('[API] Clerk Rate Limit bei doc-relations, fahre ohne Auth fort')
  }

  const ctx = await loadLibraryChatContext(userEmail, libraryId)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }
  if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
    return { ok: false, res: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }
  }
  return { ok: true, library: ctx.library }
}

/** Lädt die (optional auf `fileIds` gescopten) Kanten + Staleness-Info. */
async function buildRelationsPayload(
  library: Library,
  libraryId: string,
  fileIdsInput: string[],
): Promise<Record<string, unknown>> {
  const fileIds = [...new Set(fileIdsInput.map((s) => s.trim()).filter(Boolean))]

  const edges = await getDocRelations(libraryId, fileIds.length > 0 ? fileIds : undefined)
  const { catalogHash: storedHash, computedAt } = await getLatestCatalogHash(libraryId)

  // Aktuellen Katalog-Hash bestimmen (gleiche Signatur wie beim Recompute).
  const libraryKey = getCollectionNameForLibrary(library)
  const { items } = await findDocs(libraryKey, libraryId, {}, { limit: 500 })
  const currentHash = computeCatalogHash(
    items.map((d) => ({ fileId: d.fileId || d.id, updatedAt: d.upsertedAt })),
  )

  // Staleness: nur aussagekräftig, wenn überhaupt schon einmal berechnet wurde.
  const stale = storedHash !== null ? storedHash !== currentHash : null

  return {
    edges: edges.map((e) => ({
      source: e.sourceFileId,
      target: e.targetFileId,
      weight: e.weight,
      rationale: e.rationale,
      relationType: e.relationType,
    })),
    stale,
    currentHash,
    computedHash: storedHash,
    computedAt: computedAt ? computedAt.toISOString() : null,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    const resolved = await resolveContext(libraryId)
    if (!resolved.ok) return resolved.res

    const url = new URL(req.url)
    const fileIds = (url.searchParams.get('fileIds') || '').split(',')

    const payload = await buildRelationsPayload(resolved.library, libraryId, fileIds)
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

    const body = (await req.json().catch(() => ({}))) as { fileIds?: unknown }
    const rawIds = Array.isArray(body.fileIds) ? body.fileIds : []
    const fileIds = rawIds.filter((v): v is string => typeof v === 'string')

    const payload = await buildRelationsPayload(resolved.library, libraryId, fileIds)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
