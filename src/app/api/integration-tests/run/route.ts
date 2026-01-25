import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { runIntegrationTests } from '@/lib/integration-tests/orchestrator'
import { integrationTestCases } from '@/lib/integration-tests/test-cases'
import { saveIntegrationTestRun } from '@/lib/integration-tests/run-store'

interface RunRequestBody {
  libraryId?: string;
  folderId?: string;
  testCaseIds?: string[];
  fileIds?: string[];
  fileKind?: 'pdf' | 'audio';
  jobTimeoutMs?: number;
  templateName?: string;
  /**
   * Optional: Nur für Internal-Token Runs.
   * Im UI-Run wird userEmail aus Clerk abgeleitet.
   */
  userEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RunRequestBody

    // --- Auth-Modi ---
    // 1) UI/Browser: Clerk Session (wie bisher)
    // 2) Agent/CLI: Internal Token (kein Copy/Paste, maschinenlesbar)
    const internalToken = String(request.headers.get('X-Internal-Token') || '').trim()
    const expectedInternal = String(process.env.INTERNAL_TEST_TOKEN || '').trim()
    const hasValidInternalToken = expectedInternal.length > 0 && internalToken === expectedInternal

    let userEmail = ''
    if (hasValidInternalToken) {
      // Internal mode: userEmail muss explizit übergeben werden (damit Storage/Repo korrekt scoped)
      userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim() : ''
      if (!userEmail) {
        return NextResponse.json({ error: 'userEmail erforderlich (Internal Token Mode)' }, { status: 400 })
      }
    } else {
      const { userId } = getAuth(request)
      if (!userId) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      }
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) {
        return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
      }
    }

    const libraryId = (body.libraryId || '').trim()
    const folderId = (body.folderId || '').trim() || 'root'
    const jobTimeoutMs = typeof body.jobTimeoutMs === 'number' ? body.jobTimeoutMs : undefined
    // Wenn keine IDs übergeben werden, interpretieren wir das als "alle Testfälle".
    // Damit kann der CLI/Agent z.B. "alle Tests für genau eine Datei" starten,
    // ohne vorher IDs aus der UI kopieren zu müssen.
    const selectedIdsRaw = Array.isArray(body.testCaseIds) ? body.testCaseIds : []
    const selectedIds = selectedIdsRaw.length ? selectedIdsRaw : integrationTestCases.map(tc => tc.id)
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds : undefined
    const fileKind = body.fileKind === 'audio' ? 'audio' : body.fileKind === 'pdf' ? 'pdf' : undefined

    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })
    }
    // selectedIds ist hier immer >= 1 (entweder explizit oder "alle")

    // Validität der Testfall-IDs prüfen, um Typos früh zu erkennen
    const allIds = new Set(integrationTestCases.map(tc => tc.id))
    const invalidIds = selectedIds.filter(id => !allIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Ungültige Testfall-IDs', invalidIds },
        { status: 400 }
      )
    }

    const templateName = typeof body.templateName === 'string' && body.templateName.trim().length > 0 && body.templateName !== 'auto'
      ? body.templateName.trim()
      : undefined;

    const runId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `run_${Date.now()}_${Math.random().toString(16).slice(2)}`

    const runResult = await runIntegrationTests({
      userEmail,
      libraryId,
      folderId,
      testCaseIds: selectedIds,
      fileIds,
      fileKind,
      jobTimeoutMs,
      templateName,
    })

    // Store + Konsolen-Marker (Agent kann Terminal-Output lesen, ohne Copy/Paste aus UI)
    await saveIntegrationTestRun({
      runId,
      createdAt: new Date().toISOString(),
      userEmail,
      libraryId,
      folderId,
      testCaseIds: selectedIds,
      fileIds,
      jobTimeoutMs,
      templateName,
      result: runResult,
    })
    try {
      // Einzeilige JSON-Ausgabe für maschinelles Parsen (Terminal/Logs)
      // Beispiel: [INTEGRATION_TEST_RUN] {"runId":"...","summary":{...}}
      // eslint-disable-next-line no-console
      console.log('[INTEGRATION_TEST_RUN]', JSON.stringify({
        runId,
        userEmail,
        libraryId,
        folderId,
        summary: runResult.summary,
      }))
    } catch {}

    return NextResponse.json(
      {
        ok: true,
        runId,
        libraryId,
        folderId,
        testCaseIds: selectedIds,
        summary: runResult.summary,
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






