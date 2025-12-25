import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as z from 'zod'

const callTransformerChatMock = vi.fn()

vi.mock('@/lib/secretary/adapter', () => ({
  callTransformerChat: (args: unknown) => callTransformerChatMock(args),
}))

vi.mock('@/lib/env', () => ({
  getSecretaryConfig: () => ({ baseUrl: 'http://secretary.local/api', apiKey: 'test-key' }),
}))

describe('callLlmJson retry on SchemaValidationError', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    callTransformerChatMock.mockReset()
    process.env.LLM_SCHEMA_VALIDATION_RETRY_COUNT = '2'
    process.env.LLM_SCHEMA_VALIDATION_RETRY_BACKOFF_MS = '0'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('retries once on schema validation error, disables cache, and lowers temperature', async () => {
    const { callLlmJson } = await import('@/lib/chat/common/llm')

    const schema = z.object({
      ok: z.literal(true),
    })

    // 1) First response: valid "success" wrapper, but structured_data fails zod
    // 2) Second response: valid
    callTransformerChatMock
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'success',
          data: { structured_data: { ok: false } },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'success',
          data: { structured_data: { ok: true } },
        }),
      } as unknown as Response)

    const result = await callLlmJson(
      {
        model: 'test-model',
        temperature: 0.9,
        responseFormat: { type: 'json_object' },
        messages: [{ role: 'user', content: 'hi' }],
      },
      schema,
      JSON.stringify({ type: 'object' })
    )

    expect(result.data.ok).toBe(true)
    expect(callTransformerChatMock).toHaveBeenCalledTimes(2)

    const firstCallArgs = callTransformerChatMock.mock.calls[0]?.[0] as Record<string, unknown>
    const secondCallArgs = callTransformerChatMock.mock.calls[1]?.[0] as Record<string, unknown>

    expect(firstCallArgs.useCache).toBe(true)
    expect(firstCallArgs.temperature).toBe(0.9)

    expect(secondCallArgs.useCache).toBe(false)
    expect(secondCallArgs.temperature).toBe(0.2)
  })
})


