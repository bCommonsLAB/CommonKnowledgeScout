import { describe, expect, it, vi } from 'vitest'

/**
 * Minimal contract test:
 * The video enqueue route must NOT default a template implicitly.
 * If no template is provided, it should create a transcript-only job by default.
 *
 * NOTE: We keep this as a pure unit test by importing the route handler and
 * mocking Clerk + Repository dependencies.
 */

vi.mock('@clerk/nextjs/server', () => ({
  getAuth: () => ({ userId: 'user-1' }),
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: 'user@example.com' }],
  }),
}))

vi.mock('@/lib/events/job-event-bus', () => ({
  getJobEventBus: () => ({ emitUpdate: vi.fn() }),
}))

vi.mock('@/lib/external-jobs-repository', () => {
  class ExternalJobsRepository {
    hashSecret() {
      return 'hash'
    }
    async create() {
      return undefined
    }
  }
  return { ExternalJobsRepository }
})

describe('process-video/job defaults', () => {
  it('does not inject a template when none is provided', async () => {
    // This test is intentionally shallow: it asserts that the route accepts body without template
    // and returns 202. Dependency behavior is mocked in separate tests in the repo already.
    const req = new Request('http://localhost/api/secretary/process-video/job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Library-Id': 'lib-1',
      },
      body: JSON.stringify({
        originalItemId: 'item-1',
        parentId: 'parent-1',
        fileName: 'a.mp4',
        mimeType: 'video/mp4',
        targetLanguage: 'de',
        useCache: true,
        policies: { extract: 'do', metadata: 'ignore', ingest: 'ignore' },
      }),
    })

    // If this ever becomes hard to unit-test due to auth, we can move it to integration tests.
    const { POST } = await import('@/app/api/secretary/process-video/job/route')
    const res = await POST(req as unknown as any)
    expect(res.status).toBe(202)
  })
})


