import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'
import { getLatestOverlapReport } from '@/lib/repositories/overlap-report-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/library/[libraryId]/overlap-report/latest — juengster
 * LLM-Overlap-Bericht der Library (Stufe 3).
 *
 * Member-only (Owner + Co-Creator): der Bericht ist eine interne Analyse
 * mit Handlungsempfehlungen, kein Publikations-Inhalt. 404 = noch kein Lauf.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const allowed = await isCoCreatorOrOwner(libraryId, userEmail)
    if (!allowed) return NextResponse.json({ error: 'Kein Zugriff auf den Bericht' }, { status: 403 })

    const report = await getLatestOverlapReport(libraryId)
    if (!report) return NextResponse.json({ error: 'Noch kein Bericht berechnet' }, { status: 404 })
    return NextResponse.json({ report }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
