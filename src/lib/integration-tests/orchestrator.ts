/**
 * @fileoverview Integration Test Orchestrator for PDF Transformation
 *
 * @description
 * Führt definierte Integrationstestfälle gegen das bestehende External-Job-System aus:
 * - Bereitet Shadow-Twin-Zustand im Storage vor
 * - Erstellt External-Jobs via interner Create-Route
 * - Setzt Phasen/Policies auf dem Job
 * - Startet die Verarbeitung über die Start-Route
 * - Wartet auf Abschluss und validiert Ergebnisse (MongoDB + Storage)
 *
 * @module integration-tests
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getPublicAppUrl } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'
import { integrationTestCases, type IntegrationTestCase, type PhasePoliciesValue } from './test-cases'
import { listPdfTestFiles, prepareShadowTwinForTestCase, type PdfTestFile } from './pdf-upload'
import { validateExternalJobForTestCase, type JobValidationResult } from './validators'

export interface RunIntegrationTestsArgs {
  userEmail: string;
  libraryId: string;
  /**
   * Ordner-ID in der aktiven Library, die als Testverzeichnis dient.
   * Alle PDFs in diesem Ordner werden als Test-Targets betrachtet.
   */
  folderId: string;
  /** IDs der gewünschten Testfälle (z.B. ['TC-1.1', 'TC-2.5']) */
  testCaseIds: string[];
  /**
   * Optionale Einschränkung auf bestimmte Files (Storage-Item-IDs).
   * Wenn leer/undefined, werden alle PDFs im Ordner verwendet.
   */
  fileIds?: string[];
  /**
   * Maximaler Zeitrahmen pro Job (Millisekunden).
   * Standard: 10 Minuten.
   */
  jobTimeoutMs?: number;
}

export interface SingleTestExecutionResult {
  testCase: IntegrationTestCase;
  file: PdfTestFile;
  jobId: string;
  validation: JobValidationResult;
}

export interface IntegrationTestRunResult {
  results: SingleTestExecutionResult[];
}

function mapPhaseValueToDirective(value: PhasePoliciesValue | undefined): 'ignore' | 'do' | 'force' {
  if (!value) return 'do'
  if (value === 'force') return 'force'
  if (value === 'ignore') return 'ignore'
  if (value === 'skip') return 'ignore'
  // 'auto' → Gate respektiert: entspricht 'do'
  if (value === 'auto') return 'do'
  return 'do'
}

function buildPoliciesObject(testCase: IntegrationTestCase): {
  policies: { extract: 'ignore' | 'do' | 'force'; metadata: 'ignore' | 'do' | 'force'; ingest: 'ignore' | 'do' | 'force' };
} {
  const p = testCase.policies || {}
  const extract = mapPhaseValueToDirective(p.extract)
  const metadata = mapPhaseValueToDirective(p.metadata)
  const ingest = mapPhaseValueToDirective(p.ingest)
  return { policies: { extract, metadata, ingest } }
}

async function createExternalJobForFile(args: {
  userEmail: string;
  libraryId: string;
  file: PdfTestFile;
  testCase: IntegrationTestCase;
}): Promise<{ jobId: string }> {
  const { userEmail, libraryId, file, testCase } = args
  const appUrlRaw = getPublicAppUrl() || process.env.NEXT_PUBLIC_APP_URL || ''
  const appUrl = appUrlRaw.replace(/\/$/, '')
  const internalToken = process.env.INTERNAL_TEST_TOKEN || ''
  if (!internalToken) {
    throw new Error('INTERNAL_TEST_TOKEN nicht konfiguriert – Integrationstests können nicht ausgeführt werden')
  }

  const extractionMethod =
    testCase.mistralOptions && testCase.mistralOptions.forceRecompute !== undefined ? 'mistral_ocr' : 'native'

  const body: Record<string, unknown> = {
    libraryId,
    parentId: file.parentId,
    fileName: file.name,
    itemId: file.itemId,
    mimeType: file.mimeType,
    userEmail,
    targetLanguage: 'de',
    extractionMethod,
  }

  const createRes = await fetch(`${appUrl}/api/external/jobs/internal/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': internalToken,
    },
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '')
    throw new Error(`Job-Erstellung fehlgeschlagen (${createRes.status}): ${text}`)
  }

  const json = (await createRes.json()) as { jobId: string }
  if (!json.jobId) throw new Error('Antwort von /internal/create enthält keine jobId')
  return { jobId: json.jobId }
}

async function configureJobParameters(args: {
  jobId: string;
  testCase: IntegrationTestCase;
}): Promise<void> {
  const { jobId, testCase } = args
  const repo = new ExternalJobsRepository()

  const phases = {
    extract: testCase.phases.extract,
    template: testCase.phases.template,
    ingest: testCase.phases.ingest,
  }

  const merged: Record<string, unknown> = {
    phases,
    ...buildPoliciesObject(testCase),
  }

  // Zusatzflags für Mistral-Tests
  if (testCase.mistralOptions) {
    merged['useCache'] = !testCase.mistralOptions.forceRecompute
  }

  await repo.mergeParameters(jobId, merged)
}

async function startExternalJob(args: { jobId: string }): Promise<void> {
  const { jobId } = args
  const appUrlRaw = getPublicAppUrl() || process.env.NEXT_PUBLIC_APP_URL || ''
  const appUrl = appUrlRaw.replace(/\/$/, '')
  const internalToken = process.env.INTERNAL_TEST_TOKEN || ''
  const url = `${appUrl}/api/external/jobs/${encodeURIComponent(jobId)}/start`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Internal-Token': internalToken,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Start-Route für Job ${jobId} fehlgeschlagen (${res.status}): ${text}`)
  }
}

async function waitForJobCompletion(args: {
  jobId: string;
  timeoutMs: number;
}): Promise<import('@/types/external-job').ExternalJob> {
  const { jobId, timeoutMs } = args
  const repo = new ExternalJobsRepository()
  const started = Date.now()
  const pollIntervalMs = 2_000

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await repo.get(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} während Polling nicht mehr gefunden`)
    }
    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timeout beim Warten auf Job ${jobId} (Status: ${job.status})`)
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }
}

export async function runIntegrationTests(args: RunIntegrationTestsArgs): Promise<IntegrationTestRunResult> {
  const { userEmail, libraryId, folderId, testCaseIds, fileIds, jobTimeoutMs } = args
  const timeoutMs = jobTimeoutMs && jobTimeoutMs > 0 ? jobTimeoutMs : 10 * 60_000

  const selectedCases = integrationTestCases.filter(tc => testCaseIds.includes(tc.id))
  if (selectedCases.length === 0) {
    throw new Error('Keine gültigen Testfall-IDs übergeben')
  }

  const allPdfs = await listPdfTestFiles({ userEmail, libraryId, folderId })
  const targetFiles = Array.isArray(fileIds) && fileIds.length > 0
    ? allPdfs.filter(f => fileIds.includes(f.itemId))
    : allPdfs

  if (targetFiles.length === 0) {
    throw new Error('Im gewählten Ordner wurden keine PDF-Dateien gefunden')
  }

  const results: SingleTestExecutionResult[] = []

  for (const file of targetFiles) {
    for (const testCase of selectedCases) {
      try {
        FileLogger.info('integration-tests', 'Starte Testfall', {
          testCaseId: testCase.id,
          fileName: file.name,
          libraryId,
          folderId,
        })

        // 1) Shadow-Twin-Zustand vorbereiten (falls definiert)
        const prepareResult = await prepareShadowTwinForTestCase({
          userEmail,
          libraryId,
          source: file,
          state: testCase.shadowTwinState,
          lang: 'de',
        })

        // 2) Job erstellen
        const { jobId } = await createExternalJobForFile({ userEmail, libraryId, file, testCase })

        // 2a) Info über verwendete Dateien im Job-Trace speichern (für Test-Protokoll)
        if (prepareResult) {
          try {
            const repo = new ExternalJobsRepository()
            await repo.traceAddEvent(jobId, {
              spanId: 'job',
              name: 'integration_test_preparation',
              attributes: {
                testCaseId: testCase.id,
                usedRealFiles: prepareResult.usedRealFiles,
                details: prepareResult.details,
              },
            })
          } catch {
            // Trace-Fehler nicht kritisch
          }
        }

        // 3) Parameter (Phasen/Policies) auf dem Job setzen
        await configureJobParameters({ jobId, testCase })

        // 4) Job über Start-Route anstoßen (Secretary-Interaktion + Worker-Logik)
        await startExternalJob({ jobId })

        // 5) Auf Abschluss warten
        await waitForJobCompletion({ jobId, timeoutMs })

        // 6) Validieren
        const validation = await validateExternalJobForTestCase(testCase, jobId)

        results.push({
          testCase,
          file,
          jobId,
          validation,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        FileLogger.error('integration-tests', 'Testfall fehlgeschlagen', {
          error: message,
          stack: error instanceof Error ? error.stack : undefined,
          testCaseId: testCase.id,
          fileName: file.name,
        })

        // Auch im Fehlerfall einen Eintrag erzeugen, damit die UI den Case sehen kann
        results.push({
          testCase,
          file,
          jobId: 'n/a',
          validation: {
            jobId: 'n/a',
            testCaseId: testCase.id,
            ok: false,
            messages: [
              {
                type: 'error',
                message,
              },
            ],
          },
        })
      }
    }
  }

  return { results }
}


