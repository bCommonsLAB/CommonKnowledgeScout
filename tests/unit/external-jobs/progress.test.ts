import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { ExternalJob } from '@/types/external-job'
import type { RequestContext } from '@/types/external-jobs'
import { handleProgressIfAny } from '@/lib/external-jobs/progress'

vi.mock('@/lib/external-jobs-watchdog', () => ({
  bumpWatchdog: vi.fn(),
}))

vi.mock('@/lib/external-jobs-log-buffer', () => ({
  bufferLog: vi.fn(),
}))

vi.mock('@/lib/events/job-event-bus', () => ({
  getJobEventBus: () => ({ emitUpdate: vi.fn() }),
}))

function makeAudioJob(partial?: Partial<ExternalJob>): ExternalJob {
  return {
    jobId: 'job-1',
    jobSecretHash: 'hash',
    job_type: 'audio',
    operation: 'transcribe',
    worker: 'secretary',
    status: 'running',
    libraryId: 'lib-1',
    userEmail: 'user@example.com',
    correlation: {
      jobId: 'job-1',
      libraryId: 'lib-1',
      source: { mediaType: 'audio', mimeType: 'audio/*', name: 'a.m4a', itemId: 'item-1', parentId: 'parent-1' },
      options: { targetLanguage: 'de', sourceLanguage: 'auto', useCache: true },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

describe('handleProgressIfAny', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not short-circuit on audio final webhook (phase=completed + transcription.text)', async () => {
    const job = makeAudioJob()
    const ctx: RequestContext = {
      request: null as unknown as Request,
      jobId: job.jobId,
      job,
      body: { phase: 'completed', data: { transcription: { text: 'hello' } } } as unknown as Record<string, unknown>,
      callbackToken: 'tok',
      internalBypass: false,
    }

    const repo = {
      get: vi.fn(async () => job),
      updateStep: vi.fn(async () => undefined),
      traceAddEvent: vi.fn(async () => undefined),
    } as unknown as {
      get: (id: string) => Promise<ExternalJob>
      updateStep: (id: string, step: string, patch: unknown) => Promise<void>
      traceAddEvent: (id: string, evt: unknown) => Promise<void>
    }

    const res = await handleProgressIfAny(ctx, repo as any)
    expect(res).toBeNull()
  })

  it('marks extract_audio as running for progress updates on audio jobs', async () => {
    const job = makeAudioJob({ steps: [] })
    const ctx: RequestContext = {
      request: null as unknown as Request,
      jobId: job.jobId,
      job,
      body: { phase: 'progress', data: { progress: 5 }, message: 'init' } as unknown as Record<string, unknown>,
      callbackToken: 'tok',
      internalBypass: false,
    }

    const repo = {
      get: vi.fn(async () => job),
      updateStep: vi.fn(async () => undefined),
      traceAddEvent: vi.fn(async () => undefined),
    } as unknown as {
      get: (id: string) => Promise<ExternalJob>
      updateStep: (id: string, step: string, patch: unknown) => Promise<void>
      traceAddEvent: (id: string, evt: unknown) => Promise<void>
    }

    const res = await handleProgressIfAny(ctx, repo as any)
    expect(res?.body).toMatchObject({ kind: 'progress' })
    expect((repo.updateStep as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toBe('extract_audio')
  })
})


