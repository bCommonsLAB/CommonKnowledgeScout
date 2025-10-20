import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/chat/ingestion-service', () => ({
  IngestionService: {
    upsertMarkdown: vi.fn().mockResolvedValue({ chunksUpserted: 3, docUpserted: true, index: 'idx-1' })
  }
}))

import { runIngestion } from '@/lib/external-jobs/ingest'

describe('ingest.runIngestion', () => {
  beforeEach(() => { /* Modul-Mocks behalten */ })
  it('calls service and forwards result', async () => {
    const ctx = { jobId: 'j', job: { userEmail: 'u', libraryId: 'L' } } as any
    const res = await runIngestion({ ctx, savedItemId: 'f1', fileName: 'doc.md', markdown: '# x', meta: {} as any })
    expect(res.chunksUpserted).toBe(3)
    expect(res.index).toBe('idx-1')
  })
})


