/**
 * Characterization Tests fuer src/lib/secretary/client.ts —
 * Audio-, Video-, Text- und Track-Funktionen.
 *
 * Welle 2.1 Schritt 3.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  transformAudio,
  transformVideo,
  transformText,
  transformTextWithTemplate,
  createTrackSummary,
  createAllTrackSummaries,
  SecretaryServiceError,
} from '@/lib/secretary/client'

const realFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('transformAudio', () => {
  it('postet FormData an /api/secretary/process-audio mit X-Library-Id', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ status: 'ok' }))

    const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' })
    await transformAudio(file, 'de', 'lib-1', false)

    const call = fm.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-audio'),
    )
    expect(call).toBeDefined()
    const init = call?.[1] as RequestInit & { headers: Record<string, string> }
    expect(init.method).toBe('POST')
    expect(init.headers['X-Library-Id']).toBe('lib-1')
    const fd = init.body as FormData
    expect(fd.get('targetLanguage')).toBe('de')
    expect(fd.get('useCache')).toBe('false')
  })

  it('wirft SecretaryServiceError bei response.ok=false', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(new Response('x', { status: 502, statusText: 'fail' }))
    const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' })
    await expect(transformAudio(file, 'de', 'lib-1')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
  })
})

describe('transformVideo', () => {
  it('schickt FormData mit Video-spezifischen Optionen extractAudio/extractFrames', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ status: 'ok' }))

    const file = new File(['x'], 'a.mp4', { type: 'video/mp4' })
    await transformVideo(
      file,
      { extractAudio: true, extractFrames: false, frameInterval: 5, targetLanguage: 'en' },
      'lib-1',
    )

    const call = fm.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-video'),
    )
    expect(call).toBeDefined()
    const fd = call?.[1]?.body as FormData
    expect(fd.get('extractAudio')).toBe('true')
    expect(fd.get('extractFrames')).toBe('false')
    expect(fd.get('frameInterval')).toBe('5')
    expect(fd.get('targetLanguage')).toBe('en')
  })

  it('schickt KEINE Felder fuer undefined-Optionen', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ status: 'ok' }))
    const file = new File(['x'], 'a.mp4', { type: 'video/mp4' })
    await transformVideo(file, {}, 'lib-1')
    const call = fm.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/api/secretary/process-video'),
    )
    const fd = call?.[1]?.body as FormData
    expect(fd.has('extractAudio')).toBe(false)
    expect(fd.has('extractFrames')).toBe(false)
    expect(fd.has('frameInterval')).toBe(false)
    expect(fd.has('template')).toBe(false)
  })
})

describe('transformText', () => {
  it('wirft SecretaryServiceError wenn Text leer ist (kein HTTP-Call)', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    await expect(transformText('   ', 'de', 'lib-1')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
    expect(fm).not.toHaveBeenCalled()
  })

  it('liefert data.text aus Response zurueck', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ text: 'transformed' }))
    const r = await transformText('Hallo', 'en', 'lib-1', 'Custom')
    expect(r).toBe('transformed')
    const fd = fm.mock.calls[0][1]?.body as FormData
    expect(fd.get('template')).toBe('Custom')
  })
})

describe('transformTextWithTemplate', () => {
  it('wirft SecretaryServiceError wenn Template-Content leer ist', async () => {
    await expect(
      transformTextWithTemplate('Hallo', 'de', 'lib-1', '   '),
    ).rejects.toBeInstanceOf(SecretaryServiceError)
  })

  it('liefert data.text aus Response zurueck', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ text: 'tpl-result' }))
    const r = await transformTextWithTemplate('Hallo', 'de', 'lib-1', 'tpl-content')
    expect(r).toBe('tpl-result')
  })
})

describe('createTrackSummary', () => {
  it('wirft SecretaryServiceError wenn trackName leer ist (kein HTTP-Call)', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    await expect(createTrackSummary('', 'de', 'lib-1')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
    expect(fm).not.toHaveBeenCalled()
  })

  it('postet JSON-Body an /api/secretary/tracks/<encoded>/summary', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ ok: true }))
    await createTrackSummary('Track A/B', 'de', 'lib-1', 'tpl', true)
    const call = fm.mock.calls[0]
    expect(String(call[0])).toContain(encodeURIComponent('Track A/B'))
    const init = call[1] as RequestInit
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body.template).toBe('tpl')
    expect(body.target_language).toBe('de')
    expect(body.useCache).toBe(true)
  })
})

describe('createAllTrackSummaries', () => {
  it('postet an /api/secretary/tracks/*/summarize_all', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(jsonResponse({ ok: true }))
    await createAllTrackSummaries('en', 'lib-1')
    const call = fm.mock.calls[0]
    expect(String(call[0])).toContain('/api/secretary/tracks/*/summarize_all')
  })

  it('wirft SecretaryServiceError bei response.ok=false', async () => {
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(new Response('x', { status: 500, statusText: 'fail' }))
    await expect(createAllTrackSummaries('en', 'lib-1')).rejects.toBeInstanceOf(
      SecretaryServiceError,
    )
  })
})
