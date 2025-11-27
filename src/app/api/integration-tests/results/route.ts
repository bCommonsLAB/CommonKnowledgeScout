import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { integrationTestCases } from '@/lib/integration-tests/test-cases'
import { validateExternalJobForTestCase } from '@/lib/integration-tests/validators'

interface ResultsRequestBodyItem {
  jobId?: string;
  testCaseId?: string;
}

interface ResultsRequestBody {
  items?: ResultsRequestBodyItem[];
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

    const body = (await request.json().catch(() => ({}))) as ResultsRequestBody
    const items = Array.isArray(body.items) ? body.items : []
    if (!items.length) {
      return NextResponse.json({ error: 'Keine Items übergeben' }, { status: 400 })
    }

    const byId = new Map(integrationTestCases.map(tc => [tc.id, tc]))
    const results = []

    for (const it of items) {
      const jobId = (it.jobId || '').trim()
      const testCaseId = (it.testCaseId || '').trim()
      if (!jobId || !testCaseId) continue

      const testCase = byId.get(testCaseId)
      if (!testCase) {
        results.push({
          jobId,
          testCaseId,
          ok: false,
          messages: [{ type: 'error', message: `Unbekannter Testfall: ${testCaseId}` }],
        })
        continue
      }

      const validation = await validateExternalJobForTestCase(testCase, jobId)
      // Die tatsächliche Auth-Zuordnung (userEmail vs. Job.userEmail) wird implizit
      // durch die Mongo-Query in validateExternalJobForTestCase / Repository erzwungen.
      results.push({
        jobId: validation.jobId,
        testCaseId: validation.testCaseId,
        ok: validation.ok,
        messages: validation.messages,
      })
    }

    return NextResponse.json({ ok: true, results }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler bei Ergebnis-Auswertung'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}






