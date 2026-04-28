/**
 * Tests fuer den Image-Analyzer Orphan-Guard.
 *
 * Verifiziert:
 *   1. Schutz greift, wenn `transform_template` bereits `running` ist
 *      und `startedAt` jung genug fuer einen plausiblen Vision-Call ist.
 *   2. Kein Schutz, wenn der Step `pending`, `completed` oder `failed` ist.
 *   3. Kein Schutz, wenn der Step zwar `running`, aber zu alt ist
 *      (= verlorene Vorgaenger-Instanz, neuer Versuch ist legitim).
 *   4. Kein Schutz bei Repository-Fehler (sicherer Default — wir blockieren
 *      keinen legitimen Job, falls Mongo kurzzeitig haengt).
 *   5. Kein Schutz, wenn der Job keinen passenden Step hat.
 */
import { describe, it, expect, vi } from 'vitest'
import { checkImageAnalyzerOrphan } from '@/lib/external-jobs/image-analyzer-orphan-guard'
import type { ExternalJob } from '@/types/external-job'

// Minimaler Repo-Stub: nur die Felder, die der Guard braucht.
function makeRepoStub(getResult: ExternalJob | null | (() => never)) {
  return {
    get: vi.fn(async (_jobId: string) => {
      if (typeof getResult === 'function') {
        // Erlaubt Throw-Simulation.
        ;(getResult as () => never)()
      }
      return getResult
    }),
  } as unknown as Parameters<typeof checkImageAnalyzerOrphan>[0]
}

function makeJobWithStep(stepStatus: 'pending' | 'running' | 'completed' | 'failed', startedAtMs: number | null): ExternalJob {
  return {
    jobId: 'job-1',
    jobSecretHash: 'h',
    job_type: 'image',
    operation: 'extract',
    worker: 'secretary',
    status: 'running',
    libraryId: 'lib-1',
    userEmail: 'u@x',
    correlation: { jobId: 'job-1', libraryId: 'lib-1' },
    parameters: {},
    payload: {},
    steps: [
      {
        name: 'transform_template',
        status: stepStatus,
        ...(startedAtMs !== null ? { startedAt: new Date(startedAtMs) } : {}),
      },
    ],
  } as unknown as ExternalJob
}

describe('checkImageAnalyzerOrphan', () => {
  it('blockiert, wenn Step bereits running und startedAt jung ist', async () => {
    // Step laeuft seit 30 Sekunden — innerhalb plausibler Vision-Call-Dauer.
    const job = makeJobWithStep('running', Date.now() - 30_000)
    const repo = makeRepoStub(job)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(true)
    expect(result.stepName).toBe('transform_template')
    expect(result.stepRunningSinceMs).toBeGreaterThanOrEqual(30_000)
  })

  it('laesst durch, wenn Step pending ist (= noch nicht gestartet)', async () => {
    const job = makeJobWithStep('pending', null)
    const repo = makeRepoStub(job)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })

  it('laesst durch, wenn Step completed ist (= Vorgaenger fertig)', async () => {
    const job = makeJobWithStep('completed', Date.now() - 5_000)
    const repo = makeRepoStub(job)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })

  it('laesst durch, wenn Step zu alt ist (= verlorene Instanz)', async () => {
    // 11 Minuten — ueber dem 10-Minuten-Schwellenwert.
    const job = makeJobWithStep('running', Date.now() - 11 * 60 * 1000)
    const repo = makeRepoStub(job)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })

  it('laesst durch, wenn der Step keinen startedAt-Zeitstempel hat', async () => {
    // Edge-Case: running ohne startedAt — nicht unser Job, kein Skip.
    const job = makeJobWithStep('running', null)
    const repo = makeRepoStub(job)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })

  it('laesst durch, wenn der Job keinen passenden Step hat', async () => {
    const job = {
      ...makeJobWithStep('running', Date.now()),
      steps: [{ name: 'extract_pdf', status: 'completed' }],
    } as unknown as ExternalJob
    const repo = makeRepoStub(job)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })

  it('laesst durch, wenn das Repository einen Fehler wirft (sicherer Default)', async () => {
    const repo = makeRepoStub(() => { throw new Error('mongo-down') })

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })

  it('laesst durch, wenn der Job in Mongo nicht existiert', async () => {
    const repo = makeRepoStub(null)

    const result = await checkImageAnalyzerOrphan(repo, 'job-1')

    expect(result.shouldSkip).toBe(false)
  })
})
