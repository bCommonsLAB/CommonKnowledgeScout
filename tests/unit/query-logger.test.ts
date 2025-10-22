import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries-repo', () => {
  return {
    insertQueryLog: vi.fn(async (_doc: unknown) => 'test-query-id'),
    appendRetrievalStep: vi.fn(async () => {}),
    updateQueryLogPartial: vi.fn(async () => {}),
  }
})

import { startQueryLog, appendRetrievalStep, setPrompt, finalizeQueryLog, failQueryLog } from '@/lib/logging/query-logger'
import * as repo from '@/lib/db/queries-repo'

describe('query-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('startQueryLog returns queryId and inserts pending log', async () => {
    const id = await startQueryLog({
      libraryId: 'lib-1',
      userEmail: 'u@example.com',
      question: 'Was ist RAG?',
      mode: 'chunks',
      facetsSelected: { year: [2024] },
      filtersNormalized: { kind: { $eq: 'chunk' } },
      filtersPinecone: { kind: { $eq: 'chunk' } },
    })
    expect(id).toBe('test-query-id')
    expect(repo.insertQueryLog).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(repo.insertQueryLog).mock.calls[0][0] as Record<string, unknown>
    expect(arg.status).toBe('pending')
  })

  it('appendRetrievalStep clamps snippets to <=300 chars', async () => {
    const longText = 'x'.repeat(1200)
    await appendRetrievalStep('qid', {
      indexName: 'idx',
      stage: 'query',
      level: 'chunk',
      results: [{ id: 'a', type: 'chunk', snippet: longText }],
    })
    expect(repo.appendRetrievalStep).toHaveBeenCalledTimes(1)
    const step = vi.mocked(repo.appendRetrievalStep).mock.calls[0][1] as { results?: Array<{ snippet?: string }> }
    expect(step.results?.[0]?.snippet?.length).toBeLessThanOrEqual(300)
  })

  it('setPrompt redacts long token-like sequences', async () => {
    const secret = 'sk_live_' + 'a'.repeat(30)
    await setPrompt('qid', { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2, prompt: `key=${secret}` })
    expect(repo.updateQueryLogPartial).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(repo.updateQueryLogPartial).mock.calls[0][1] as { prompt?: { prompt?: string } }
    expect(payload.prompt?.prompt?.includes(secret)).toBe(false)
    expect(payload.prompt?.prompt?.includes('***')).toBe(true)
  })

  it('finalizeQueryLog sets status ok and stores answer/sources/timing', async () => {
    await finalizeQueryLog('qid', {
      answer: '42',
      sources: [{ id: 'v1', score: 0.9 }],
      timing: { retrievalMs: 10, llmMs: 20, totalMs: 30 },
      tokenUsage: { totalTokens: 123 },
    })
    expect(repo.updateQueryLogPartial).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(repo.updateQueryLogPartial).mock.calls[0][1] as Record<string, unknown>
    expect(payload.status).toBe('ok')
    expect(payload.answer).toBe('42')
  })

  it('failQueryLog sets status error and stores error', async () => {
    await failQueryLog('qid', { message: 'boom', stage: 'query' })
    expect(repo.updateQueryLogPartial).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(repo.updateQueryLogPartial).mock.calls[0][1] as Record<string, unknown>
    expect(payload.error).toEqual({ message: 'boom', stage: 'query' })
  })
})




