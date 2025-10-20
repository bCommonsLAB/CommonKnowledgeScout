import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decideTemplateRun } from '@/lib/external-jobs/template-decision'

vi.mock('@/lib/external-jobs-repository', () => {
  return {
    ExternalJobsRepository: class {
      appendLog = vi.fn()
      traceAddEvent = vi.fn()
    }
  }
})

describe('template-decision', () => {
  const ctx = {
    jobId: 'job-1',
    job: { userEmail: 'u@example.com', libraryId: 'L1', correlation: {}, parameters: {} },
    body: {},
  } as unknown as Parameters<typeof decideTemplateRun>[0]['ctx']

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('skips when fm complete and policy auto (no callback)', async () => {
    const res = await decideTemplateRun({
      ctx,
      policies: { metadata: 'auto', ingest: 'upsert' },
      isFrontmatterCompleteFromBody: true,
      templateGateExists: false,
      autoSkip: true,
      isTemplateCompletedCallback: false,
    })
    expect(res.shouldRun).toBe(false)
  })

  it('runs when policy force', async () => {
    const res = await decideTemplateRun({
      ctx,
      policies: { metadata: 'force', ingest: 'upsert' },
      isFrontmatterCompleteFromBody: true,
      templateGateExists: true,
      autoSkip: true,
      isTemplateCompletedCallback: false,
    })
    expect(res.shouldRun).toBe(true)
  })

  it('runs on callback + repair', async () => {
    const res = await decideTemplateRun({
      ctx,
      policies: { metadata: 'auto', ingest: 'upsert' },
      isFrontmatterCompleteFromBody: false,
      templateGateExists: true,
      autoSkip: true,
      isTemplateCompletedCallback: true,
    })
    expect(res.shouldRun).toBe(true)
  })
})


