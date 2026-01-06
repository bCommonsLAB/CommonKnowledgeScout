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
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { IngestionService } from '@/lib/chat/ingestion-service'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

export interface RunIntegrationTestsArgs {
  userEmail: string;
  libraryId: string;
  /**
   * Ordner-ID in der aktiven Library, die als Testverzeichnis dient.
   * Alle PDFs in diesem Ordner werden als Test-Targets betrachtet.
   */
  folderId: string;
  /** IDs der gewünschten Testfälle (z.B. ['pdf_mistral_report.happy_path']) */
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
  /**
   * Optional: Template-Name als Run-Override.
   * Wenn gesetzt, wird dieser Template-Name für alle Jobs verwendet (deterministisch).
   * Wenn undefined, verwendet die Pipeline den Default-Pick.
   */
  templateName?: string;
}

export interface SingleTestExecutionResult {
  testCase: IntegrationTestCase;
  file: PdfTestFile;
  jobId: string;
  validation: JobValidationResult;
}

export interface IntegrationTestRunResult {
  results: SingleTestExecutionResult[];
  /** Zusammenfassung: Anzahl erfolgreicher/fehlgeschlagener Tests */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
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
  templateName?: string;
}): Promise<void> {
  const { jobId, testCase, templateName } = args
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

  // Template-Override: Wenn templateName gesetzt ist, setze es als Parameter
  if (templateName && templateName.trim().length > 0) {
    merged['template'] = templateName.trim()
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

function pushValidationMessage(
  validation: JobValidationResult,
  type: 'info' | 'warn' | 'error',
  message: string
): void {
  validation.messages.push({ type, message })
  if (type === 'error') validation.ok = false
}

function serializeFrontmatter(meta: Record<string, unknown>): string {
  return Object.entries(meta)
    .map(([key, value]) => {
      if (value === null || value === undefined) return `${key}: ""`
      if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`
      if (typeof value === 'string' && value.includes('\n')) {
        return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`
      }
      return `${key}: ${value}`
    })
    .join('\n')
}

async function runPdfHitlPublishWorkflow(args: {
  userEmail: string
  libraryId: string
  file: PdfTestFile
  testCase: IntegrationTestCase
  timeoutMs: number
  templateName?: string
}): Promise<{ jobId: string; validation: JobValidationResult }> {
  const { userEmail, libraryId, file, testCase, timeoutMs, templateName } = args
  const repo = new ExternalJobsRepository()
  let extractJobId: string | null = null
  let templateJobId: string | null = null

  const validation: JobValidationResult = {
    jobId: 'n/a',
    testCaseId: testCase.id,
    ok: true,
    messages: [],
  }

  try {
    // 0) Shadow‑Twin clean (deterministisch)
    await prepareShadowTwinForTestCase({
      userEmail,
      libraryId,
      source: file,
      state: 'clean',
      lang: 'de',
    })

    // 1) Job1: Extract-only
    const job1Case: IntegrationTestCase = {
      ...testCase,
      id: `${testCase.id}::job1_extract`,
      phases: { extract: true, template: false, ingest: false },
      policies: { extract: 'do', metadata: 'ignore', ingest: 'ignore' },
      expected: { shouldComplete: true, expectShadowTwinExists: true },
    }
    const created1 = await createExternalJobForFile({ userEmail, libraryId, file, testCase: job1Case })
    extractJobId = created1.jobId
    validation.jobId = extractJobId
    pushValidationMessage(validation, 'info', `HITL Workflow: Job1 Extract=${extractJobId}`)

    await configureJobParameters({ jobId: extractJobId, testCase: job1Case, templateName: undefined })
    await startExternalJob({ jobId: extractJobId })
    const extractJob = await waitForJobCompletion({ jobId: extractJobId, timeoutMs })
    if (extractJob.status !== 'completed') {
      const err = extractJob.error?.message || extractJob.error || 'unknown'
      pushValidationMessage(validation, 'error', `Job1 Extract ist nicht completed (status=${extractJob.status}, error=${String(err)})`)
      return { jobId: extractJobId, validation }
    }
    if (!extractJob.result?.savedItemId) {
      pushValidationMessage(validation, 'error', 'Job1 Extract completed, aber result.savedItemId fehlt')
      return { jobId: extractJobId, validation }
    }

    // 2) Job2: Template-only (extract skip, ingest ignore)
    const job2Case: IntegrationTestCase = {
      ...testCase,
      id: `${testCase.id}::job2_template`,
      phases: { extract: true, template: true, ingest: false },
      policies: { extract: 'ignore', metadata: 'do', ingest: 'ignore' },
      expected: { shouldComplete: true, expectShadowTwinExists: true },
    }
    const created2 = await createExternalJobForFile({ userEmail, libraryId, file, testCase: job2Case })
    templateJobId = created2.jobId
    validation.jobId = templateJobId
    pushValidationMessage(validation, 'info', `HITL Workflow: Job2 Template=${templateJobId}`)

    await configureJobParameters({ jobId: templateJobId, testCase: job2Case, templateName })
    await startExternalJob({ jobId: templateJobId })
    const templateJob = await waitForJobCompletion({ jobId: templateJobId, timeoutMs })
    if (templateJob.status !== 'completed') {
      const err = templateJob.error?.message || templateJob.error || 'unknown'
      pushValidationMessage(validation, 'error', `Job2 Template ist nicht completed (status=${templateJob.status}, error=${String(err)})`)
      return { jobId: templateJobId, validation }
    }

    // 3) Baseline-Validierung auf Job2 (Global Contract + Shadow‑Twin vorhanden)
    const baseValidation = await validateExternalJobForTestCase(testCase, templateJobId)
    validation.ok = baseValidation.ok
    validation.messages = [...validation.messages, ...baseValidation.messages]

    const transformFileId = templateJob.result?.savedItemId
    if (!transformFileId) {
      pushValidationMessage(validation, 'error', 'Publish: Job2 completed, aber result.savedItemId (Transformationsdatei) fehlt')
      return { jobId: templateJobId, validation }
    }

    // 4) Publish: Frontmatter overwrite + Ingestion (kein extra finales MD)
    const provider = await getServerProvider(userEmail, libraryId)
    const shadowTwinFolder = await findShadowTwinFolder(file.parentId, file.name, provider)
    if (!shadowTwinFolder) {
      pushValidationMessage(validation, 'error', 'Publish: Shadow‑Twin-Verzeichnis nicht gefunden')
      return { jobId: templateJobId, validation }
    }

    const baseStem = file.name.replace(/\.[^/.]+$/, '')
    const expectedTransformName = `${baseStem}.${(templateName || 'pdfanalyse').trim()}.de.md`

    const transformItem = await provider.getItemById(transformFileId).catch(() => null)
    if (!transformItem || transformItem.type !== 'file') {
      pushValidationMessage(validation, 'error', 'Publish: Transformationsdatei konnte nicht geladen werden')
      return { jobId: templateJobId, validation }
    }

    const originalMarkdown = await (await provider.getBinary(transformFileId)).blob.text()
    const { body } = parseFrontmatter(originalMarkdown)

    // Deterministischer Marker: wir setzen 2 Felder, die sicher im PDFAnalyse-Schema existieren.
    const publishMeta: Record<string, unknown> = {
      title: 'Integration Test – HITL Publish',
      slug: 'integration-test-hitl-publish',
    }
    const overwrittenMarkdown = `---\n${serializeFrontmatter(publishMeta)}\n---\n\n${body}`

    // Overwrite by delete+upload (kein overwrite-by-id)
    await provider.deleteItem(transformFileId)
    const updatedTransform = await provider.uploadFile(
      shadowTwinFolder.id,
      new File([overwrittenMarkdown], String(transformItem.metadata?.name || expectedTransformName), { type: 'text/markdown' })
    )

    pushValidationMessage(validation, 'info', `Publish: Transformationsdatei überschrieben: ${updatedTransform.id}`)
    pushValidationMessage(validation, 'info', 'Publish Contract: savedItemId==transformFileId (kein extra finales MD)')

    // Ingestion (direkt via Service, wie ingest-markdown Route)
    const updatedText = await (await provider.getBinary(updatedTransform.id)).blob.text()
    const ingestRes = await IngestionService.upsertMarkdown(
      userEmail,
      libraryId,
      updatedTransform.id,
      String(updatedTransform.metadata?.name || expectedTransformName),
      updatedText,
      undefined,
      undefined,
      provider
    )
    if (ingestRes.chunksUpserted <= 0) {
      pushValidationMessage(validation, 'error', 'Publish: Ingestion erwartete chunksUpserted > 0, war aber 0')
    } else {
      pushValidationMessage(validation, 'info', `Publish: Ingestion OK (chunksUpserted=${ingestRes.chunksUpserted})`)
    }

    return { jobId: templateJobId, validation }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const fallbackJobId = templateJobId || extractJobId || 'n/a'
    validation.jobId = fallbackJobId
    pushValidationMessage(validation, 'error', `HITL Workflow Exception: ${msg}`)
    if (extractJobId) {
      const j = await repo.get(extractJobId).catch(() => null)
      if (j?.status) pushValidationMessage(validation, 'info', `Job1 status=${j.status}`)
    }
    if (templateJobId) {
      const j = await repo.get(templateJobId).catch(() => null)
      if (j?.status) pushValidationMessage(validation, 'info', `Job2 status=${j.status}`)
    }
    return { jobId: fallbackJobId, validation }
  }
}

export async function runIntegrationTests(args: RunIntegrationTestsArgs): Promise<IntegrationTestRunResult> {
  const { userEmail, libraryId, folderId, testCaseIds, fileIds, jobTimeoutMs, templateName } = args
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

        if (testCase.workflow === 'pdf_hitl_publish') {
          const res = await runPdfHitlPublishWorkflow({
            userEmail,
            libraryId,
            file,
            testCase,
            timeoutMs,
            templateName,
          })
          results.push({ testCase, file, jobId: res.jobId, validation: res.validation })
        } else {
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
          await configureJobParameters({ jobId, testCase, templateName })

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
        }
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

  // Zusammenfassung berechnen
  const summary = {
    total: results.length,
    passed: results.filter(r => r.validation.ok).length,
    failed: results.filter(r => !r.validation.ok).length,
    skipped: 0, // Wird aktuell nicht verwendet, kann später für skipped Tests genutzt werden
  }

  FileLogger.info('integration-tests', 'Testlauf abgeschlossen', {
    summary,
    testCaseIds: selectedCases.map(tc => tc.id),
    fileCount: targetFiles.length,
  })

  return { results, summary }
}


