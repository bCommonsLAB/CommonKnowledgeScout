/**
 * Characterization Tests fuer src/lib/secretary/adapter.ts.
 *
 * Welle 2.1 Schritt 3 — fixiert das **aktuelle** Verhalten der 5 low-
 * level Adapter-Funktionen (callPdfProcess, callTemplateTransform,
 * callTextTranslate, callTransformerChat, callTemplateExtractFromUrl)
 * vor moeglichen Refactors in Schritt 4.
 *
 * @see docs/refactor/secretary/AGENT-BRIEF.md (E2 + E4)
 * @see .cursor/rules/secretary-contracts.mdc §7
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

vi.mock('@/lib/templates/template-service', () => ({
  serializeTemplateWithoutCreation: vi.fn((s: string) => s),
}))

import { fetchWithTimeout, HttpError, NetworkError } from '@/lib/utils/fetch-with-timeout'
import {
  callPdfProcess,
  callTemplateTransform,
  callTextTranslate,
  callTransformerChat,
  callTemplateExtractFromUrl,
} from '@/lib/secretary/adapter'

const mockedFetch = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>

function makeOkResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeFailResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText: 'Bad Request',
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockedFetch.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('callPdfProcess', () => {
  it('schickt POST mit Authorization-Header wenn apiKey gesetzt ist', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'application/pdf' }), 'a.pdf')

    await callPdfProcess({
      url: 'http://test.invalid/api/pdf',
      formData: fd,
      apiKey: 'k-secret',
      timeoutMs: 1000,
    })

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockedFetch.mock.calls[0]
    expect(callArgs[0]).toBe('http://test.invalid/api/pdf')
    const init = callArgs[1] as RequestInit & { headers: Record<string, string>; timeoutMs?: number }
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer k-secret')
    expect(init.headers['X-Secretary-Api-Key']).toBe('k-secret')
    expect((init as unknown as { timeoutMs?: number }).timeoutMs).toBe(1000)
  })

  it('wirft HttpError bei Status >= 400', async () => {
    mockedFetch.mockResolvedValueOnce(makeFailResponse(500, { error: 'boom' }))
    const fd = new FormData()

    await expect(
      callPdfProcess({ url: 'http://test.invalid/api/pdf', formData: fd }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('mappt unbekannte Fehler nach NetworkError', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('socket hang up'))
    const fd = new FormData()

    await expect(
      callPdfProcess({ url: 'http://test.invalid/api/pdf', formData: fd }),
    ).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('callTemplateTransform', () => {
  it('baut JSON-Body mit allen Default-Feldern und ruft serializeTemplateWithoutCreation auf', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))

    await callTemplateTransform({
      url: 'http://test.invalid/api/transformer/template',
      text: 'hello',
      targetLanguage: 'en',
      templateContent: 'tpl-content',
    })

    const init = mockedFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.text).toBe('hello')
    expect(body.template_content).toBe('tpl-content')
    // sourceLanguage faellt auf targetLanguage zurueck
    expect(body.source_language).toBe('en')
    expect(body.target_language).toBe('en')
    expect(body.use_cache).toBe(false)
    expect(body.context).toEqual({})
    expect(body.callback_url).toBeNull()
  })

  it('haengt model nur an wenn explizit gesetzt', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
    await callTemplateTransform({
      url: 'http://test.invalid/api',
      text: 't',
      targetLanguage: 'de',
      templateContent: 'x',
      model: 'gemini-flash',
    })
    const body = JSON.parse(String(mockedFetch.mock.calls[0][1]?.body))
    expect(body.model).toBe('gemini-flash')
  })

  it('wirft HttpError mit detaillierter Message aus errorData.error.message', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeFailResponse(400, { error: { code: 'X', message: 'Detail-Message' } }),
    )

    let caught: unknown
    try {
      await callTemplateTransform({
        url: 'http://test.invalid/api',
        text: 't',
        targetLanguage: 'de',
        templateContent: 'x',
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(HttpError)
    expect((caught as HttpError).message).toMatch(/Detail-Message/)
  })
})

describe('callTextTranslate', () => {
  it('verwendet sourceLanguage Default = targetLanguage', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
    await callTextTranslate({
      url: 'http://test.invalid/api/translate',
      text: 'a',
      targetLanguage: 'de',
    })
    const body = JSON.parse(String(mockedFetch.mock.calls[0][1]?.body))
    expect(body.source_language).toBe('de')
    expect(body.target_language).toBe('de')
    expect(body.use_cache).toBe(false)
  })

  it('wirft NetworkError bei nicht-Http-Fehler', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('dns fail'))
    await expect(
      callTextTranslate({
        url: 'http://test.invalid/api/translate',
        text: 'a',
        targetLanguage: 'de',
      }),
    ).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('callTransformerChat', () => {
  it('serialisiert messages als JSON in URLSearchParams-Body', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
    await callTransformerChat({
      url: 'http://test.invalid/api/transformer/chat',
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4',
    })
    const init = mockedFetch.mock.calls[0][1] as RequestInit
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    const params = new URLSearchParams(String(init.body))
    expect(JSON.parse(params.get('messages') ?? '[]')).toEqual([
      { role: 'user', content: 'hi' },
    ])
    expect(params.get('model')).toBe('gpt-4')
    expect(params.get('use_cache')).toBe('true')
  })

  it('reichert HttpError-Message mit URL/Status an', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeFailResponse(429, { error: 'rate limited' }),
    )
    let caught: HttpError | undefined
    try {
      await callTransformerChat({
        url: 'http://test.invalid/api/transformer/chat',
        messages: [{ role: 'user', content: 'hi' }],
      })
    } catch (e) {
      caught = e as HttpError
    }
    expect(caught).toBeInstanceOf(HttpError)
    // Der enhanced-message enthaelt den Statuscode
    expect(String(caught?.message)).toMatch(/429/)
  })
})

describe('callTemplateExtractFromUrl', () => {
  it('wirft 400 HttpError bei ungueltiger URL', async () => {
    let caught: HttpError | undefined
    try {
      await callTemplateExtractFromUrl({
        url: 'nicht-eine-url',
        templateUrl: 'http://test.invalid/api/extract',
      })
    } catch (e) {
      caught = e as HttpError
    }
    expect(caught).toBeInstanceOf(HttpError)
    expect(caught?.status).toBe(400)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('verwendet Default-Template wenn weder template noch templateContent gesetzt', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
    await callTemplateExtractFromUrl({
      url: 'http://valid.example/page',
      templateUrl: 'http://test.invalid/api/extract',
    })
    const body = String(mockedFetch.mock.calls[0][1]?.body)
    const params = new URLSearchParams(body)
    expect(params.get('template')).toBe('ExtractSessionDataFromWebsite')
    expect(params.get('source_language')).toBe('en')
  })

  it('haengt container_selector nur an wenn nicht-leer', async () => {
    mockedFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
    await callTemplateExtractFromUrl({
      url: 'http://valid.example/page',
      templateUrl: 'http://test.invalid/api/extract',
      containerSelector: '   ',
    })
    const params = new URLSearchParams(String(mockedFetch.mock.calls[0][1]?.body))
    expect(params.has('container_selector')).toBe(false)
  })
})
