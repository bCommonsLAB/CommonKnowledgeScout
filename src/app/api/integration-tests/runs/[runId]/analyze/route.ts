import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import {
  addIntegrationTestRunNote,
  buildAutoAnalysisNote,
  getIntegrationTestRun,
  type StoredIntegrationTestRunNote,
} from '@/lib/integration-tests/run-store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const id = String(runId || '').trim()
    if (!id) return NextResponse.json({ error: 'runId fehlt' }, { status: 400 })

    const run = await getIntegrationTestRun(id)
    if (!run) return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 })

    // Auth-Modi: Clerk oder Internal Token
    const internalToken = String(request.headers.get('X-Internal-Token') || '').trim()
    const expectedInternal = String(process.env.INTERNAL_TEST_TOKEN || '').trim()
    const hasValidInternalToken = expectedInternal.length > 0 && internalToken === expectedInternal

    let actorEmail = ''
    if (!hasValidInternalToken) {
      const { userId } = getAuth(request)
      if (!userId) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      }
      const user = await currentUser()
      actorEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!actorEmail) {
        return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
      }
      if (run.userEmail && actorEmail !== run.userEmail) {
        return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
      }
    }

    const auto = buildAutoAnalysisNote(run)

    const note: StoredIntegrationTestRunNote = {
      noteId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      authorType: 'auto',
      authorEmail: actorEmail || undefined,
      title: auto.title,
      analysisMarkdown: auto.analysisMarkdown,
      nextStepsMarkdown: auto.nextStepsMarkdown,
    }

    const updated = await addIntegrationTestRunNote(id, note)
    if (!updated) return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 })

    return NextResponse.json({ ok: true, runId: id, note }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

