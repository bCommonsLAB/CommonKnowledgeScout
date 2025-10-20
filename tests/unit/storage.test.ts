import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn().mockResolvedValue({
    uploadFile: vi.fn().mockResolvedValue({ id: 'saved-1', metadata: { name: 'doc.md' } }),
    getPathById: vi.fn().mockResolvedValue('/Library/Folder'),
  })
}))

vi.mock('@/lib/events/job-event-bus', () => ({
  getJobEventBus: () => ({ emitUpdate: vi.fn() })
}))

import { saveMarkdown } from '@/lib/external-jobs/storage'

describe('storage.saveMarkdown', () => {
  beforeEach(() => { /* Modul-Mocks behalten */ })
  it('uploads markdown and returns savedItemId', async () => {
    const ctx = { jobId: 'j', job: { userEmail: 'u', libraryId: 'L', job_type: 'pdf', correlation: { source: { itemId: 'src' } } } } as any
    const res = await saveMarkdown({ ctx, parentId: 'root', fileName: 'doc.md', markdown: '# Test' })
    expect(res.savedItemId).toBe('saved-1')
  })
})


