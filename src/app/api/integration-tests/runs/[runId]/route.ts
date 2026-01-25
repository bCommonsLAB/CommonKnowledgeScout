import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { getIntegrationTestRun } from '@/lib/integration-tests/run-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const id = String(runId || '').trim()
    if (!id) return NextResponse.json({ error: 'runId fehlt' }, { status: 400 })

    // Auth-Modi: Clerk oder Internal Token (wie bei /run)
    const internalToken = String(request.headers.get('X-Internal-Token') || '').trim()
    const expectedInternal = String(process.env.INTERNAL_TEST_TOKEN || '').trim()
    const hasValidInternalToken = expectedInternal.length > 0 && internalToken === expectedInternal

    if (!hasValidInternalToken) {
      const { userId } = getAuth(request)
      if (!userId) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      }
      const user = await currentUser()
      const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) {
        return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
      }
    }

    const run = await getIntegrationTestRun(id)
    if (!run) return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 })

    // Wenn Clerk-User nutzt: simple Ownership-Guard (UI sollte nicht fremde Runs lesen)
    if (!hasValidInternalToken) {
      const user = await currentUser()
      const email = user?.emailAddresses?.[0]?.emailAddress || ''
      if (email && run.userEmail && email !== run.userEmail) {
        return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
      }
    }

    return NextResponse.json(
      {
        ok: true,
        runId: run.runId,
        createdAt: run.createdAt,
        libraryId: run.libraryId,
        folderId: run.folderId,
        testCaseIds: run.testCaseIds,
        fileIds: run.fileIds,
        jobTimeoutMs: run.jobTimeoutMs,
        templateName: run.templateName,
        summary: run.result.summary,
        notes: Array.isArray(run.notes) ? run.notes : [],
        results: run.result.results.map(r => ({
          testCaseId: r.testCase.id,
          testCaseLabel: r.testCase.label,
          fileName: r.file.name,
          fileId: r.file.itemId,
          jobId: r.jobId,
          ok: r.validation.ok,
          messages: r.validation.messages,
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

