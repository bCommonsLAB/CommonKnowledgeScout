import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { runIntegrationTests } from '@/lib/integration-tests/orchestrator'
import { integrationTestCases } from '@/lib/integration-tests/test-cases'

interface RunRequestBody {
  libraryId?: string;
  folderId?: string;
  testCaseIds?: string[];
  fileIds?: string[];
  jobTimeoutMs?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as RunRequestBody
    const libraryId = (body.libraryId || '').trim()
    const folderId = (body.folderId || '').trim() || 'root'
    const jobTimeoutMs = typeof body.jobTimeoutMs === 'number' ? body.jobTimeoutMs : undefined
    const selectedIds = Array.isArray(body.testCaseIds) ? body.testCaseIds : []
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds : undefined

    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })
    }
    if (!selectedIds.length) {
      return NextResponse.json({ error: 'Mindestens ein Testfall muss ausgewählt werden' }, { status: 400 })
    }

    // Validität der Testfall-IDs prüfen, um Typos früh zu erkennen
    const allIds = new Set(integrationTestCases.map(tc => tc.id))
    const invalidIds = selectedIds.filter(id => !allIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Ungültige Testfall-IDs', invalidIds },
        { status: 400 }
      )
    }

    const runResult = await runIntegrationTests({
      userEmail,
      libraryId,
      folderId,
      testCaseIds: selectedIds,
      fileIds,
      jobTimeoutMs,
    })

    return NextResponse.json(
      {
        ok: true,
        libraryId,
        folderId,
        testCaseIds: selectedIds,
        results: runResult.results.map(r => ({
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
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler bei Integrationstests'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}






