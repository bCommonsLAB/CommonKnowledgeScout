import { describe, it, expect, vi } from 'vitest'
import { runTemplateTransform } from '@/lib/external-jobs/template-run'

vi.mock('@/lib/secretary/adapter', () => ({
  callTemplateTransform: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { structured_data: { shortTitle: 'Hello', tags: ['A', 'B'] } } })
  })
}))

describe('template-run', () => {
  it('returns meta on valid structured_data', async () => {
    const ctx = { jobId: 'j1', job: {}, body: {} } as any
    const res = await runTemplateTransform({ ctx, extractedText: 't', templateContent: '#', targetLanguage: 'de' })
    expect(res.meta).toBeTruthy()
  })
})


