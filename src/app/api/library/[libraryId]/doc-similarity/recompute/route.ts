import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isLibraryOwner } from '@/lib/repositories/library-members-repo'
import { enqueueDocSimilarityJob } from '@/lib/external-jobs/enqueue-doc-similarity'
import { ExternalJobsWorker } from '@/lib/external-jobs-worker'
import { FileLogger } from '@/lib/debug/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/library/[libraryId]/doc-similarity/recompute — stoesst die
 * Neuberechnung der persistierten Aehnlichkeits-Nachbarn (Stufe 4c) an.
 *
 * Nur Owner (teurer Vector-Pass, 1 Suche je Doc). Erzeugt EINEN external-job
 * (ADR 0001); der Worker fuehrt `phase-doc-similarity` aus. Danach liest der
 * Graph die Kanten aus den Docs statt live zu rechnen.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const allowed = await isLibraryOwner(libraryId, userEmail)
    if (!allowed) return NextResponse.json({ error: 'Nur der Owner darf die Nachbarn neu berechnen' }, { status: 403 })

    const { jobId } = await enqueueDocSimilarityJob({ libraryId, userEmail })

    // Worker sofort anstossen (sonst bleibt der Job queued, falls der
    // Intervall in diesem Prozess noch nie startete — Muster overlap-report).
    void ExternalJobsWorker.tickNow().catch((err) => {
      FileLogger.warn('doc-similarity', 'tickNow nach Enqueue fehlgeschlagen (Job bleibt queued)', {
        jobId, error: err instanceof Error ? err.message : String(err),
      })
    })
    return NextResponse.json({ ok: true, jobId }, { status: 202 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
