import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isLibraryOwner } from '@/lib/repositories/library-members-repo'
import { enqueueOverlapReportJob } from '@/lib/external-jobs/enqueue-overlap-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RecomputeBody {
  /** LLM-Modell fuer den Lauf (z.B. ein 1M-Kontext-Modell). */
  model?: string
  /** Aktive Galerie-Facetten-Filter ({ metaKey: string[] }) — grenzen den Bestand ein. */
  filters?: Record<string, string[]>
  maxMeasures?: number
  /** Bericht-Vorlage aus der Vorlagenverwaltung (sonst eingebauter Default). */
  reportTemplateId?: string
}

/**
 * POST /api/library/[libraryId]/overlap-report/recompute — stoesst den
 * LLM-Overlap-Bericht an (Plan summen-und-synergie-aggregation, Stufe 3).
 *
 * Nur Owner (teurer Long-Context-LLM-Lauf). Erzeugt EINEN `external-jobs`-Job
 * (ADR 0001); der Worker fuehrt `phase-overlap-report` aus. Ergebnis:
 * Markdown-Bericht in `overlap_reports` + `korrektur_*`-Faktoren pro Massnahme.
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

    let body: RecomputeBody = {}
    try {
      body = (await request.json()) as RecomputeBody
    } catch {
      body = {}
    }
    const filters =
      body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
        ? body.filters
        : undefined

    const { jobId } = await enqueueOverlapReportJob({
      libraryId,
      userEmail,
      model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined,
      filters,
      maxMeasures: typeof body.maxMeasures === 'number' ? body.maxMeasures : undefined,
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
