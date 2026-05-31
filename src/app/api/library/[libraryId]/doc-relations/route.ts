import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { getCollectionNameForLibrary, findDocs } from '@/lib/repositories/vector-repo'
import { getDocRelations, getLatestCatalogHash } from '@/lib/repositories/doc-relations-repo'
import { computeCatalogHash } from '@/lib/gallery/relations-staleness'

/**
 * GET /api/library/[libraryId]/doc-relations — Quelle A des Graph-Modus
 * (berechnete, gerichtete, gewichtete „Supports"-Kanten, Zielbild §5.4).
 *
 * Lädt die vorberechneten Kanten aus `doc_relations__<libraryId>` und meldet
 * über einen Katalog-Hash, ob sie VERALTET sind (seit der letzten Berechnung
 * haben sich Dokumente geändert). Öffentlich lesbar (wie die docs-Route):
 * veröffentlichte Libraries dürfen anonym lesen; Neuberechnen bleibt
 * Owner/Co-Creator (eigene POST-Route).
 *
 * Optionaler `fileIds`-Parameter scoped die Kanten auf die sichtbare
 * (gefilterte) Galerie-Menge — Kanten zwischen ausgefilterten Knoten entfallen.
 *
 * Kein Silent Fallback: fehlende Library → 404; nicht-öffentlich + anonym → 401.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params

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
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const url = new URL(req.url)
    const fileIdsRaw = url.searchParams.get('fileIds') || ''
    const fileIds = [...new Set(fileIdsRaw.split(',').map((s) => s.trim()).filter(Boolean))]

    const edges = await getDocRelations(libraryId, fileIds.length > 0 ? fileIds : undefined)
    const { catalogHash: storedHash, computedAt } = await getLatestCatalogHash(libraryId)

    // Aktuellen Katalog-Hash bestimmen (gleiche Signatur wie beim Recompute).
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const { items } = await findDocs(libraryKey, libraryId, {}, { limit: 500 })
    const currentHash = computeCatalogHash(
      items.map((d) => ({ fileId: d.fileId || d.id, updatedAt: d.upsertedAt })),
    )

    // Staleness: nur aussagekräftig, wenn überhaupt schon einmal berechnet wurde.
    const stale = storedHash !== null ? storedHash !== currentHash : null

    return NextResponse.json(
      {
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
      },
      { status: 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
