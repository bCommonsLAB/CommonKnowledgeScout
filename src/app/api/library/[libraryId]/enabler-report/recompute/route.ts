import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isLibraryOwner } from '@/lib/repositories/library-members-repo'
import { getDocRelations } from '@/lib/repositories/doc-relations-repo'
import { enqueueEnablerReportJob } from '@/lib/external-jobs/enqueue-enabler-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RecomputeBody {
  /** LLM-Modell fuer den Prosa-Pass. */
  model?: string
  /** Bericht-Vorlage; sonst Library-Kopie 'bericht-enabler' bzw. Builtin. */
  reportTemplateId?: string
}

/**
 * POST /api/library/[libraryId]/enabler-report/recompute — stoesst den
 * Enabler-Hebel-Bericht (Stufe 4b) an.
 *
 * Seit 2026-07-11 template-getrieben MIT LLM-Prosa-Pass — daher external-job
 * (Worker fuehrt `phase-enabler-report` aus), nicht mehr synchron. Nur Owner.
 * Vorab-Check hier: ohne berechnete Beziehungen ist der Bericht sinnlos → 400
 * mit klarer Anweisung statt spaeter fehlschlagendem Job.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const allowed = await isLibraryOwner(libraryId, userEmail)
    if (!allowed) return NextResponse.json({ error: 'Nur der Owner darf den Bericht berechnen' }, { status: 403 })

    const edges = await getDocRelations(libraryId)
    if (edges.length === 0) {
      return NextResponse.json(
        { error: 'Keine berechneten Beziehungen vorhanden — zuerst "Beziehungen berechnen" ausführen.' },
        { status: 400 },
      )
    }

    let body: RecomputeBody = {}
    try {
      body = (await request.json()) as RecomputeBody
    } catch {
      body = {}
    }

    const { jobId } = await enqueueEnablerReportJob({
      libraryId,
      userEmail,
      model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined,
      reportTemplateId:
        typeof body.reportTemplateId === 'string' && body.reportTemplateId.trim()
          ? body.reportTemplateId.trim()
          : undefined,
    })
    return NextResponse.json({ ok: true, jobId }, { status: 202 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
