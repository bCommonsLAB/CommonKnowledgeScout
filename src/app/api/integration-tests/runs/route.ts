import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { listIntegrationTestRuns } from '@/lib/integration-tests/run-store'

export async function GET(request: NextRequest) {
  try {
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

    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : undefined
    const libraryId = url.searchParams.get('libraryId') || undefined
    const folderId = url.searchParams.get('folderId') || undefined

    const runs = await listIntegrationTestRuns({ limit, libraryId, folderId })

    // API-Response bewusst „lightweight“ halten
    return NextResponse.json(
      {
        ok: true,
        runs: runs.map((r) => ({
          runId: r.runId,
          createdAt: r.createdAt,
          userEmail: r.userEmail,
          libraryId: r.libraryId,
          folderId: r.folderId,
          testCaseIds: r.testCaseIds,
          fileIds: r.fileIds,
          jobTimeoutMs: r.jobTimeoutMs,
          templateName: r.templateName,
          notesCount: Array.isArray(r.notes) ? r.notes.length : 0,
          summary: r.result.summary,
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

