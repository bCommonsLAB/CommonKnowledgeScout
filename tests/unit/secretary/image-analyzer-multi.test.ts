/**
 * @fileoverview Unit-Tests für `callImageAnalyzerTemplate` (Secretary-Adapter).
 *
 * Geprüft wird:
 * - Single-Image-Pfad (Backwards-Compat): genau ein `file`-Form-Feld
 * - Multi-Image-Pfad: N `files`-Form-Felder in der korrekten Reihenfolge
 * - Validierung: weder `file` noch `files` → Throw
 * - Fehler-Mapping: 4xx-Response → HttpError
 *
 * @see docs/_secretary-service-docu/image-analyzer.md
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// fetchWithTimeout mocken — wir wollen die FormData-Konstruktion prüfen,
// ohne tatsächlich einen HTTP-Request abzuschicken.
vi.mock('@/lib/utils/fetch-with-timeout', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/fetch-with-timeout')>(
    '@/lib/utils/fetch-with-timeout'
  )
  return {
    ...actual,
    fetchWithTimeout: vi.fn(),
  }
})

// Template-Service mocken, damit wir nicht den echten serializer ziehen.
vi.mock('@/lib/templates/template-service', () => ({
  serializeTemplateWithoutCreation: vi.fn((s: string) => s),
}))

// env mocken, damit kein realer Pfad-Bau gemacht werden muss.
vi.mock('@/lib/env', () => ({
  getSecretaryImageAnalyzerRelativePath: vi.fn(() => 'image-analyzer/process'),
  buildSecretaryServiceApiUrl: vi.fn(
    (base: string, rel: string) => `${base.replace(/\/+$/, '')}/api/${rel}`
  ),
}))

/**
 * Hilfsfunktion: Liest alle Form-Feld-Namen + zugehörige File-Namen aus einer
 * abgefangenen fetchWithTimeout-Anfrage aus.
 */
async function inspectFormData(call: unknown[]): Promise<{
  url: string
  fields: Array<{ name: string; value: unknown }>
  fileFields: Array<{ name: string; fileName: string; size: number; type: string }>
}> {
  const [url, init] = call as [string, { body: FormData }]
  const fd = init.body
  const fields: Array<{ name: string; value: unknown }> = []
  const fileFields: Array<{ name: string; fileName: string; size: number; type: string }> = []

  // FormData.entries() liefert [name, value] — value ist Blob/File oder string.
  for (const [name, value] of fd.entries()) {
    if (value instanceof Blob) {
      const f = value as File
      fileFields.push({
        name,
        fileName: f.name ?? '',
        size: value.size,
        type: value.type,
      })
    } else {
      fields.push({ name, value })
    }
  }
  return { url, fields, fileFields }
}

describe('callImageAnalyzerTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('single-image-Pfad: setzt genau ein "file"-Feld (Backwards-Compat)', async () => {
    const { fetchWithTimeout } = await import('@/lib/utils/fetch-with-timeout')
    const mockOk = new Response(JSON.stringify({ status: 'success', data: { text: '...' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    ;(fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk)

    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    await callImageAnalyzerTemplate({
      baseUrl: 'https://secretary.test',
      apiKey: 'k',
      file: Buffer.from('image-bytes'),
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      templateContent: 'tpl',
      targetLanguage: 'de',
    })

    const call = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const inspected = await inspectFormData(call)

    // Genau ein "file"-Feld, kein "files"-Feld
    const fileFields = inspected.fileFields.filter(f => f.name === 'file')
    const filesFields = inspected.fileFields.filter(f => f.name === 'files')
    expect(fileFields).toHaveLength(1)
    expect(filesFields).toHaveLength(0)
    expect(fileFields[0].fileName).toBe('foto.jpg')
    expect(fileFields[0].type).toBe('image/jpeg')
  })

  it('multi-image-Pfad: setzt N "files"-Felder in der Array-Reihenfolge', async () => {
    const { fetchWithTimeout } = await import('@/lib/utils/fetch-with-timeout')
    const mockOk = new Response(JSON.stringify({ status: 'success', data: { text: '...' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    ;(fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk)

    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    await callImageAnalyzerTemplate({
      baseUrl: 'https://secretary.test',
      apiKey: 'k',
      files: [
        { file: Buffer.from('a'), fileName: 'page_009.jpeg', mimeType: 'image/jpeg' },
        { file: Buffer.from('bb'), fileName: 'page_010.jpeg', mimeType: 'image/jpeg' },
        { file: Buffer.from('ccc'), fileName: 'page_011.jpeg', mimeType: 'image/jpeg' },
      ],
      templateContent: 'tpl',
      targetLanguage: 'de',
    })

    const call = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const inspected = await inspectFormData(call)

    // Genau drei "files"-Felder, kein "file"-Feld (Single-Pfad nicht aktiv)
    const fileFields = inspected.fileFields.filter(f => f.name === 'file')
    const filesFields = inspected.fileFields.filter(f => f.name === 'files')
    expect(fileFields).toHaveLength(0)
    expect(filesFields).toHaveLength(3)

    // Reihenfolge MUSS erhalten bleiben — sie ist Teil des Cache-Keys.
    expect(filesFields.map(f => f.fileName)).toEqual([
      'page_009.jpeg',
      'page_010.jpeg',
      'page_011.jpeg',
    ])
    // Reihenfolge sicherstellen über Größen-Vergleich (a=1B, bb=2B, ccc=3B)
    expect(filesFields.map(f => f.size)).toEqual([1, 2, 3])
  })

  it('multi-image-Pfad: akzeptiert auch Blob-Eingaben (nicht nur Buffer)', async () => {
    const { fetchWithTimeout } = await import('@/lib/utils/fetch-with-timeout')
    const mockOk = new Response(JSON.stringify({ status: 'success', data: { text: '...' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    ;(fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk)

    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    const blob1 = new Blob([new Uint8Array([1, 2])], { type: 'image/png' })
    const blob2 = new Blob([new Uint8Array([3, 4, 5])], { type: 'image/png' })

    await callImageAnalyzerTemplate({
      baseUrl: 'https://secretary.test',
      apiKey: 'k',
      files: [
        { file: blob1, fileName: 'a.png', mimeType: 'image/png' },
        { file: blob2, fileName: 'b.png', mimeType: 'image/png' },
      ],
      templateContent: 'tpl',
      targetLanguage: 'de',
    })

    const call = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const inspected = await inspectFormData(call)
    const filesFields = inspected.fileFields.filter(f => f.name === 'files')
    expect(filesFields).toHaveLength(2)
    expect(filesFields.map(f => f.size)).toEqual([2, 3])
  })

  it('wirft, wenn weder file noch files gesetzt sind', async () => {
    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    await expect(
      callImageAnalyzerTemplate({
        baseUrl: 'https://secretary.test',
        apiKey: 'k',
        templateContent: 'tpl',
        targetLanguage: 'de',
      })
    ).rejects.toThrow(/Weder file noch files gesetzt/)
  })

  it('wirft, wenn file ohne fileName gesetzt ist', async () => {
    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    await expect(
      callImageAnalyzerTemplate({
        baseUrl: 'https://secretary.test',
        apiKey: 'k',
        file: Buffer.from('x'),
        // fileName fehlt absichtlich
        mimeType: 'image/jpeg',
        templateContent: 'tpl',
        targetLanguage: 'de',
      })
    ).rejects.toThrow(/file ohne fileName/)
  })

  it('mappt 4xx-Response auf HttpError mit Body', async () => {
    const { fetchWithTimeout, HttpError } = await import('@/lib/utils/fetch-with-timeout')
    const errBody = { error: { code: 'ProcessingError', message: 'multi-image not supported' } }
    const mockErr = new Response(JSON.stringify(errBody), {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/json' },
    })
    ;(fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr)

    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    let caught: unknown = null
    try {
      await callImageAnalyzerTemplate({
        baseUrl: 'https://secretary.test',
        apiKey: 'k',
        files: [
          { file: Buffer.from('x'), fileName: 'a.jpg', mimeType: 'image/jpeg' },
          { file: Buffer.from('y'), fileName: 'b.jpg', mimeType: 'image/jpeg' },
        ],
        templateContent: 'tpl',
        targetLanguage: 'de',
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(HttpError)
    const httpErr = caught as InstanceType<typeof HttpError>
    expect(httpErr.status).toBe(400)
    expect(httpErr.message).toContain('multi-image not supported')
  })

  it('setzt Standard-Felder template_content, target_language und useCache', async () => {
    const { fetchWithTimeout } = await import('@/lib/utils/fetch-with-timeout')
    const mockOk = new Response(JSON.stringify({ status: 'success', data: { text: '...' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    ;(fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk)

    const { callImageAnalyzerTemplate } = await import('@/lib/secretary/image-analyzer')

    await callImageAnalyzerTemplate({
      baseUrl: 'https://secretary.test',
      apiKey: 'k',
      files: [
        { file: Buffer.from('x'), fileName: 'a.jpg', mimeType: 'image/jpeg' },
        { file: Buffer.from('y'), fileName: 'b.jpg', mimeType: 'image/jpeg' },
      ],
      templateContent: 'mein-template',
      targetLanguage: 'en',
      useCache: false,
    })

    const call = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const inspected = await inspectFormData(call)

    expect(inspected.fields.find(f => f.name === 'template_content')?.value).toBe('mein-template')
    expect(inspected.fields.find(f => f.name === 'target_language')?.value).toBe('en')
    expect(inspected.fields.find(f => f.name === 'useCache')?.value).toBe('false')
  })
})
