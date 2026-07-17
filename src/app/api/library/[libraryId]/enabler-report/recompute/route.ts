import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isLibraryOwner } from '@/lib/repositories/library-members-repo'
import { LibraryService } from '@/lib/services/library-service'
import { computeAndStoreEnablerReport } from '@/lib/graph/enabler-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/library/[libraryId]/enabler-report/recompute — rechnet den
 * Enabler-Hebel-Bericht (Stufe 4b) NEU aus den berechneten Beziehungen.
 *
 * Nur Owner. DETERMINISTISCH und schnell (~1-2s, kein LLM) — daher synchron,
 * kein external-job. Persistiert Bericht (kind 'enabler') + hebel_*-Keys.
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
    if (!allowed) return NextResponse.json({ error: 'Nur der Owner darf den Bericht berechnen' }, { status: 403 })

    const library = await LibraryService.getInstance().getLibraryById(libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const result = await computeAndStoreEnablerReport(library)
    return NextResponse.json(
      { ok: true, enablers: result.enablers, persisted: result.persisted, measures: result.measures },
      { status: 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
