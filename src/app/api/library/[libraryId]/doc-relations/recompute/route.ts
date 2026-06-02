import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'
import { enqueueDocRelationsJob } from '@/lib/external-jobs/enqueue-doc-relations'

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
 * Nur Owner/Co-Creator (teurer LLM-Schreibvorgang). Erzeugt EINEN
 * `external-jobs`-Job (ADR 0001); der Worker führt `phase-doc-relations` aus.
 * Die Route bleibt schmal: keine LLM-Calls, keine Schreibzugriffe auf die
 * Relations-Collection — nur Job-Erzeugung.
 *
 * Body: `{ scope: 'library' | 'source', sourceFileId? }`. Kein Silent Fallback:
 * `scope: 'source'` ohne `sourceFileId` → 400.
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
    if (scope === 'source' && !body.sourceFileId) {
      return NextResponse.json({ error: 'sourceFileId fehlt (scope=source)' }, { status: 400 })
    }

    const filters =
      body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
        ? body.filters
        : undefined

    const { jobId } = await enqueueDocRelationsJob({
      libraryId,
      userEmail,
      scope,
      sourceFileId: body.sourceFileId,
      sourceName: body.sourceName,
      relationType: body.relationType,
      relationPrompt: body.relationPrompt,
      filters,
    })

    return NextResponse.json({ ok: true, jobId, scope }, { status: 202 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
