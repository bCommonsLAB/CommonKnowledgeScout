import { describe, it, expect, vi, beforeEach } from 'vitest'

const repoMock = {
  updateStep: vi.fn().mockResolvedValue(undefined),
  setResult: vi.fn().mockResolvedValue(undefined),
  setStatus: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    updateStep = repoMock.updateStep
    setResult = repoMock.setResult
    setStatus = repoMock.setStatus
  }
}))

vi.mock('@/lib/external-jobs-log-buffer', () => ({
  drainBufferedLogs: vi.fn()
}))

import { setJobCompleted } from '@/lib/external-jobs/complete'

describe('complete.setJobCompleted', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it('marks job completed and returns ok', async () => {
    const ctx = { jobId: 'j', job: { payload: {}, result: {} } } as any
    const res = await setJobCompleted({ ctx, result: { savedItemId: 'x' } })
    expect(res.status).toBe('ok')
    expect(res.jobId).toBe('j')
    expect(repoMock.setStatus).toHaveBeenCalled()
  })
})


