// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: `@ks/api-client/llm-models` (Welle M2).
 *
 * Deckt sowohl den reinen Fetch-Helfer als auch den TanStack-Query-Hook ab —
 * Letzterer ist das Beweis-Ziel der Welle (`LlmModelSelector` nutzt genau
 * diesen Hook statt eines eigenen `fetch`-Aufrufs).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchLlmModels, useLlmModels } from '@ks/api-client'
import type { ReactNode } from 'react'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('@ks/api-client/llm-models', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchLlmModels ruft die oeffentliche Route auf (Default-Scope)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    await fetchLlmModels()

    expect(fetchMock).toHaveBeenCalledWith('/api/public/llm-models', undefined)
  })

  it('fetchLlmModels ruft die geschuetzte Route auf, wenn scope=authenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    await fetchLlmModels('authenticated')

    expect(fetchMock).toHaveBeenCalledWith('/api/llm-models', undefined)
  })

  it('useLlmModels laedt die Modelle und liefert sie ueber data', async () => {
    const models = [
      { _id: 'a', name: 'A', provider: 'p', modelId: 'a', supportedLanguages: ['de'], strengths: 's', isActive: true, order: 1, createdAt: '', updatedAt: '' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => models }))

    const { result } = renderHook(() => useLlmModels(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toEqual(models))
  })

  it('useLlmModels fragt nicht ab, wenn enabled=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useLlmModels('public', { enabled: false }), { wrapper: createWrapper() })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
