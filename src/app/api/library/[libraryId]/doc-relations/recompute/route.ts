import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'
import { enqueueDocRelationsJob } from '@/lib/external-jobs/enqueue-doc-relations'
import { LibraryService } from '@/lib/services/library-service'
import { getCollectionNameForLibrary, findDocs } from '@/lib/repositories/vector-repo'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { RELATIONS_BATCH_SIZE } from '@/lib/gallery/relations-limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RecomputeBody {
  scope?: 'library' | 'source'
  sourceFileId?: string
  sourceName?: string
  relationType?: string
  relationPrompt?: string
  /** Aktive Galerie-Facetten-Filter ({ metaKey: string[] }) zum Eingrenzen des Katalogs. */
  filters?: Record<string, string[]>
}

/**
 * POST /api/library/[libraryId]/doc-relations/recompute — stößt die
 * Neuberechnung der berechneten Beziehungs-Kanten (Quelle A) an (Zielbild §5.5).
 *
 * Nur Owner/Co-Creator (teurer LLM-Schreibvorgang). Erzeugt `external-jobs`-Jobs
 * (ADR 0001); der Worker führt `phase-doc-relations` aus.
 *
 * - `scope: 'source'`: EIN Job für die ausgehenden Kanten einer Maßnahme.
 * - `scope: 'library'`: „für alle" — der (optional gefilterte) Maßnahmen-Bestand
 *   wird in Batches à `RELATIONS_BATCH_SIZE` aufgeteilt; je Batch EIN Hintergrund-
 *   Job. So funktioniert es unabhängig von der Katalog-/Gruppengröße, jeder Job
 *   bleibt klein/robust, und die Batches schreiben additiv (kein gegenseitiges
 *   Löschen). Kein manuelles Gruppieren mehr nötig.
 *
 * Kein Silent Fallback: `scope: 'source'` ohne `sourceFileId` → 400.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const allowed = await isCoCreatorOrOwner(libraryId, userEmail)
    if (!allowed) return NextResponse.json({ error: 'Nur Owner/Co-Creator dürfen neu berechnen' }, { status: 403 })

    let body: RecomputeBody = {}
    try {
      body = (await request.json()) as RecomputeBody
    } catch {
      body = {}
    }

    const scope: 'library' | 'source' = body.scope === 'source' ? 'source' : 'library'
    const filters =
      body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
        ? body.filters
        : undefined

    // scope='source': unveränderter Einzel-Job.
    if (scope === 'source') {
      if (!body.sourceFileId) {
        return NextResponse.json({ error: 'sourceFileId fehlt (scope=source)' }, { status: 400 })
      }
      const { jobId } = await enqueueDocRelationsJob({
        libraryId,
        userEmail,
        scope: 'source',
        sourceFileId: body.sourceFileId,
        sourceName: body.sourceName,
        relationType: body.relationType,
        relationPrompt: body.relationPrompt,
        filters,
      })
      return NextResponse.json({ ok: true, jobId, scope }, { status: 202 })
    }

    // scope='library': Maßnahmen-Bestand (optional gefiltert) in Batches aufteilen.
    const library = await LibraryService.getInstance().getLibraryById(libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    const libraryKey = getCollectionNameForLibrary(library)
    const docFilter = facetsSelectedToMongoFilter(filters)
    const { items } = await findDocs(libraryKey, libraryId, docFilter, { limit: 5000 })
    const fileIds = [
      ...new Set(
        items
          .map((d) => d.fileId || d.id)
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    ]
    if (fileIds.length === 0) {
      return NextResponse.json({ error: 'Keine Maßnahmen im (gefilterten) Bestand' }, { status: 400 })
    }

    const batches: string[][] = []
    for (let i = 0; i < fileIds.length; i += RELATIONS_BATCH_SIZE) {
      batches.push(fileIds.slice(i, i + RELATIONS_BATCH_SIZE))
    }

    const jobIds: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const { jobId } = await enqueueDocRelationsJob({
        libraryId,
        userEmail,
        scope: 'library',
        relationType: body.relationType,
        relationPrompt: body.relationPrompt,
        filters,
        focusFileIds: batches[i],
        batchInfo: { index: i + 1, total: batches.length },
      })
      jobIds.push(jobId)
    }

    return NextResponse.json(
      { ok: true, scope, sources: fileIds.length, batches: batches.length, jobIds },
      { status: 202 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
