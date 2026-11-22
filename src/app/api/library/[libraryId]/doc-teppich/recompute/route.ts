import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'
import { enqueueDocTeppichJob } from '@/lib/external-jobs/enqueue-doc-teppich'
import { ExternalJobsWorker } from '@/lib/external-jobs-worker'
import { FileLogger } from '@/lib/debug/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/library/[libraryId]/doc-teppich/recompute — stoesst die Berechnung der
 * festen Plaetze des Teppichs an (Plan `teppich-der-dokumente`, T1).
 *
 * Owner und Co-Creator: Der Lauf ist billig (keine Vector-Suche, kein LLM), aendert
 * aber, wo jedes Dokument auf der Startseite liegt. Erzeugt EINEN external-job
 * (ADR 0001); der Worker fuehrt `phase-doc-teppich` aus.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const allowed = await isCoCreatorOrOwner(libraryId, userEmail)
    if (!allowed) return NextResponse.json({ error: 'Nur Owner und Co-Creator dürfen den Teppich neu berechnen' }, { status: 403 })

    const { jobId } = await enqueueDocTeppichJob({ libraryId, userEmail })

    // Worker sofort anstossen (Muster doc-similarity/recompute).
    void ExternalJobsWorker.tickNow().catch((err) => {
      FileLogger.warn('doc-teppich', 'tickNow nach Enqueue fehlgeschlagen (Job bleibt queued)', {
        jobId, error: err instanceof Error ? err.message : String(err),
      })
    })
    return NextResponse.json({ ok: true, jobId }, { status: 202 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
