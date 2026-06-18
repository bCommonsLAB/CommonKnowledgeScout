/**
 * Tests für den gemeinsamen Job-Abschluss (finalize-completion.ts).
 *
 * Kern der A-U3-Änderung: Der Submission-Rückfluss (applyAnalysisResult) lebt in
 * EINEM Schritt, den Normal- UND Extract-Only-Pfad nutzen. Damit ist der frühere
 * Bug behoben, dass „Nur importieren und transkribieren" (Extract-Only) den
 * Rückfluss übersprang.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExternalJob } from '@/types/external-job'

// Side-Effect-/IO-Module mocken; extractSubmissionIdFromJob bleibt ECHT.
// vi.hoisted, weil vi.mock-Factories an den Dateianfang gehoben werden.
const mocks = vi.hoisted(() => ({
  applyAnalysisResult: vi.fn(async () => ({})),
  buildProvider: vi.fn(async () => ({}) as unknown),
  emitUpdate: vi.fn(),
  clearWatchdog: vi.fn(),
  drainBufferedLogs: vi.fn(),
  bufferLog: vi.fn(),
}))

vi.mock('@/lib/external-jobs/provider', () => ({ buildProvider: mocks.buildProvider }))
vi.mock('@/lib/submissions/submission-analysis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/submissions/submission-analysis')>()
  return { ...actual, applyAnalysisResult: mocks.applyAnalysisResult }
})
vi.mock('@/lib/external-jobs-log-buffer', () => ({ bufferLog: mocks.bufferLog, drainBufferedLogs: mocks.drainBufferedLogs }))
vi.mock('@/lib/external-jobs-watchdog', () => ({ clearWatchdog: mocks.clearWatchdog }))
vi.mock('@/lib/events/job-event-bus', () => ({ getJobEventBus: () => ({ emitUpdate: mocks.emitUpdate }) }))

import { finalizeJobCompletion } from '@/lib/external-jobs/finalize-completion'

/** Minimaler Fake-Repo mit den von finalize genutzten Methoden. */
function fakeRepo() {
  return {
    setResult: vi.fn(async () => {}),
    setStatus: vi.fn(async () => {}),
  }
}

function job(over: Partial<ExternalJob> = {}): ExternalJob {
  return {
    jobId: 'job-1',
    jobSecretHash: 'h',
    job_type: 'pdf',
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: 'lib-1',
    userEmail: 'user@example.com',
    providerScope: 'inbox',
    correlation: { jobId: 'job-1', libraryId: 'lib-1', source: { name: 'LILAC.pdf', itemId: 'src-1' }, options: {} },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ExternalJob
}

describe('finalizeJobCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Submission-Job: ruft applyAnalysisResult, dann setResult + setStatus(completed)', async () => {
    const repo = fakeRepo()
    const j = job({ correlation: { jobId: 'job-1', libraryId: 'lib-1', source: { name: 'LILAC.pdf', itemId: 'src-1' }, options: { submissionId: 'sub-1' } } })

    await finalizeJobCompletion({
      repo: repo as never,
      jobId: 'job-1',
      job: j,
      savedItemId: 'art-1',
      payload: { extracted_text: 'Transkript…' },
      resultRefs: { savedItemId: 'art-1', savedItems: ['art-1'] },
    })

    // Rückfluss mit dem Artefakt + danach Result/Status.
    expect(mocks.applyAnalysisResult).toHaveBeenCalledTimes(1)
    expect(mocks.applyAnalysisResult.mock.calls[0][0]).toMatchObject({ submissionId: 'sub-1', savedItemId: 'art-1' })
    expect(repo.setResult).toHaveBeenCalledTimes(1)
    expect(repo.setStatus).toHaveBeenCalledWith('job-1', 'completed')
    expect(mocks.emitUpdate).toHaveBeenCalledTimes(1)
  })

  it('Archiv-Job (keine submissionId): kein Rückfluss, normaler Abschluss', async () => {
    const repo = fakeRepo()

    await finalizeJobCompletion({
      repo: repo as never,
      jobId: 'job-1',
      job: job(),
      savedItemId: 'art-1',
      payload: {},
      resultRefs: { savedItemId: 'art-1' },
    })

    expect(mocks.applyAnalysisResult).not.toHaveBeenCalled()
    expect(repo.setStatus).toHaveBeenCalledWith('job-1', 'completed')
  })

  it('Submission-Job ohne Artefakt: wirft, KEIN completed (kein stiller leerer Abschluss)', async () => {
    const repo = fakeRepo()
    const j = job({ correlation: { jobId: 'job-1', libraryId: 'lib-1', source: { name: 'x.pdf', itemId: 'src-1' }, options: { submissionId: 'sub-1' } } })

    await expect(
      finalizeJobCompletion({
        repo: repo as never,
        jobId: 'job-1',
        job: j,
        savedItemId: undefined,
        payload: {},
        resultRefs: {},
      }),
    ).rejects.toThrow(/ohne Artefakt/)

    expect(mocks.applyAnalysisResult).not.toHaveBeenCalled()
    expect(repo.setStatus).not.toHaveBeenCalled()
  })
})
