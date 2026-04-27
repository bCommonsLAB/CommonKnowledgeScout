/**
 * Characterization Tests fuer src/lib/secretary/client.ts —
 * PDF- und Image-Transformations-Funktionen.
 *
 * Welle 2.1 Schritt 3.
 *
 * Mockt globalThis.fetch direkt, weil `client.ts` relative URLs an die
 * lokalen `/api/secretary/*`-Routen schickt (NICHT an den externen
 * Service direkt). `fetchWithTimeout` wird hier nicht benoetigt.
 *
 * @see .cursor/rules/secretary-contracts.mdc §7
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  transformPdf,
  transformImage,
  SecretaryServiceError,
} from '@/lib/secretary/client'

const realFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
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

describe('transformPdf', () => {
  it('schickt POST an /api/secretary/process-pdf mit X-Library-Id-Header', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ok', data: { extracted_text: 't' } }))

    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    await transformPdf(file, 'de', 'lib-1')

    // Erste Aufruf ist der Token-Sync (best-effort), letzter ist process-pdf.
    // Wir suchen den process-pdf-Call.
    const pdfCall = fetchMock.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-pdf'),
    )
    expect(pdfCall).toBeDefined()
    const init = pdfCall?.[1] as RequestInit & { headers: Record<string, string> }
    expect(init.method).toBe('POST')
    expect(init.headers['X-Library-Id']).toBe('lib-1')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('setzt Mistral-Default-Flags includeOcrImages/includePreviewPages/includeHighResPages bei extractionMethod=mistral_ocr', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))

    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    await transformPdf(file, 'de', 'lib-1', undefined, 'mistral_ocr')

    const pdfCall = fetchMock.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-pdf'),
    )
    const fd = pdfCall?.[1]?.body as FormData
    expect(fd.get('extractionMethod')).toBe('mistral_ocr')
    expect(fd.get('includeOcrImages')).toBe('true')
    expect(fd.get('includePreviewPages')).toBe('true')
    expect(fd.get('includeHighResPages')).toBe('true')
  })

  it('schickt KEINE Preview-Flags fuer extractionMethod=docling', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))

    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    await transformPdf(file, 'de', 'lib-1', undefined, 'docling')

    const pdfCall = fetchMock.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-pdf'),
    )
    const fd = pdfCall?.[1]?.body as FormData
    expect(fd.get('extractionMethod')).toBe('docling')
    expect(fd.get('includeOcrImages')).toBe('false')
    expect(fd.get('includePreviewPages')).toBe('false')
    expect(fd.get('includeHighResPages')).toBe('false')
  })

  it('wirft SecretaryServiceError bei response.ok=false', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(
      new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    )

    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    await expect(transformPdf(file, 'de', 'lib-1')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
  })
})

describe('transformImage', () => {
  it('schickt extraction_method (snake_case) und useCache als FormData-Felder', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok', data: { extracted_text: 'x' } }))

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await transformImage(file, 'en', 'lib-1', 'ocr', 'ctx-json', false)

    const call = fetchMock.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-image'),
    )
    expect(call).toBeDefined()
    const fd = call?.[1]?.body as FormData
    expect(fd.get('extraction_method')).toBe('ocr')
    expect(fd.get('useCache')).toBe('false')
    expect(fd.get('context')).toBe('ctx-json')
    expect(fd.get('targetLanguage')).toBe('en')
  })

  it('wirft SecretaryServiceError bei response.ok=false', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(new Response('x', { status: 503, statusText: 'fail' }))

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await expect(transformImage(file, 'en', 'lib-1')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
  })
})
