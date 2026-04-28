/**
 * Characterization Tests fuer src/lib/secretary/client.ts —
 * Session-Import-, Process-Session- und embedTextRag-Funktionen.
 *
 * embedTextRag nutzt `fetchWithTimeout` direkt + `getSecretaryConfig`,
 * deshalb anderer Mock-Stil als Audio/Video/PDF.
 *
 * Welle 2.1 Schritt 3.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/utils/fetch-with-timeout', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/fetch-with-timeout')>(
    '@/lib/utils/fetch-with-timeout',
  )
  return {
    ...actual,
    fetchWithTimeout: vi.fn(),
  }
})

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    getSecretaryConfig: vi.fn(() => ({
      baseUrl: 'http://test.invalid/api',
      apiKey: 'k-test',
    })),
  }
})

import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { getSecretaryConfig } from '@/lib/env'
import {
  importSessionFromUrl,
  extractTextFromUrl,
  processSession,
  embedTextRag,
  SecretaryServiceError,
} from '@/lib/secretary/client'

const mockedFetchWithTimeout = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>
const mockedGetSecretaryConfig = getSecretaryConfig as unknown as ReturnType<typeof vi.fn>
const realFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
  mockedFetchWithTimeout.mockReset()
  mockedGetSecretaryConfig.mockReturnValue({
    baseUrl: 'http://test.invalid/api',
    apiKey: 'k-test',
  })
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('importSessionFromUrl', () => {
  it('postet JSON an /api/secretary/import-from-url mit Default-Template', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ status: 'success', data: { text: 'hi' } }))

    await importSessionFromUrl('http://example.com/page')

    const call = fm.mock.calls[0]
    expect(String(call[0])).toContain('/api/secretary/import-from-url')
    const body = JSON.parse(String(call[1]?.body))
    expect(body.url).toBe('http://example.com/page')
    expect(body.template).toBe('ExtractSessionDataFromWebsite')
    expect(body.source_language).toBe('en')
    expect(body.target_language).toBe('en')
    expect(body.use_cache).toBe(false)
    expect(body.container_selector).toBeUndefined()
  })

  it('haengt container_selector nur bei nicht-leerem Wert an', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ status: 'success' }))
    await importSessionFromUrl('http://example.com/page', { containerSelector: '   ' })
    let body = JSON.parse(String(fm.mock.calls[0][1]?.body))
    expect(body.container_selector).toBeUndefined()

    fm.mockResolvedValue(jsonResponse({ status: 'success' }))
    await importSessionFromUrl('http://example.com/page', { containerSelector: '#main' })
    body = JSON.parse(String(fm.mock.calls[1][1]?.body))
    expect(body.container_selector).toBe('#main')
  })

  it('wirft SecretaryServiceError mit error.message aus errorData', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(
      jsonResponse({ error: { message: 'Server-Fehler' } }, 500),
    )

    await expect(
      importSessionFromUrl('http://example.com/page'),
    ).rejects.toThrowError(/Server-Fehler/)
  })
})

describe('extractTextFromUrl', () => {
  it('reicht data.text durch wenn String', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(
      jsonResponse({ status: 'success', data: { text: 'page content' } }),
    )
    const r = await extractTextFromUrl('http://example.com/page')
    expect(r.text).toBe('page content')
    expect(r.raw.data?.text).toBe('page content')
  })

  it('wirft SecretaryServiceError wenn data.text leer/fehlt', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(
      jsonResponse({ status: 'success', data: { text: '' } }),
    )
    await expect(extractTextFromUrl('http://example.com/page')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
  })
})

describe('processSession', () => {
  it('postet input als JSON an /api/secretary/session/process', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ status: 'success' }))
    await processSession({
      event: 'E',
      session: 'S',
      url: 'http://example.com',
      filename: 'a',
      track: 'T',
    })
    const call = fm.mock.calls[0]
    expect(String(call[0])).toContain('/api/secretary/session/process')
    expect(call[1]?.method).toBe('POST')
  })

  it('wirft SecretaryServiceError bei status:error im JSON', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(
      jsonResponse({ status: 'error', error: { message: 'session-fail' } }),
    )
    await expect(
      processSession({
        event: 'E', session: 'S', url: 'u', filename: 'f', track: 'T',
      }),
    ).rejects.toThrowError(/session-fail/)
  })
})

describe('embedTextRag', () => {
  it('wirft SecretaryServiceError wenn baseUrl fehlt', async () => {
    mockedGetSecretaryConfig.mockReturnValueOnce({ baseUrl: '', apiKey: 'k' })
    await expect(embedTextRag({ markdown: 'x' })).rejects.toThrowError(
      /SECRETARY_SERVICE_URL/,
    )
    expect(mockedFetchWithTimeout).not.toHaveBeenCalled()
  })

  it('wirft SecretaryServiceError wenn apiKey fehlt', async () => {
    mockedGetSecretaryConfig.mockReturnValueOnce({
      baseUrl: 'http://test.invalid/api',
      apiKey: '',
    })
    await expect(embedTextRag({ markdown: 'x' })).rejects.toThrowError(
      /SECRETARY_SERVICE_API_KEY/,
    )
  })

  it('baut URL aus baseUrl + /rag/embed-text und nutzt Default-Chunk-Werte', async () => {
    mockedFetchWithTimeout.mockResolvedValue(
      jsonResponse({ status: 'success', chunks: [] }),
    )
    await embedTextRag({ markdown: 'hello' })

    const call = mockedFetchWithTimeout.mock.calls[0]
    expect(String(call[0])).toBe('http://test.invalid/api/rag/embed-text')
    const init = call[1] as RequestInit & { headers: Record<string, string> }
    expect(init.headers.Authorization).toBe('Bearer k-test')
    const body = JSON.parse(String(init.body))
    expect(body.markdown).toBe('hello')
    expect(body.chunk_size).toBe(1000)
    expect(body.chunk_overlap).toBe(200)
    expect(body.embedding_model).toBe('voyage-3-large')
  })

  it('mappt status:error im JSON auf SecretaryServiceError', async () => {
    mockedFetchWithTimeout.mockResolvedValue(
      jsonResponse({ status: 'error', error: { message: 'rag-fehler' } }),
    )
    await expect(embedTextRag({ markdown: 'x' })).rejects.toThrowError(/rag-fehler/)
  })
})
