/**
 * Unit-Tests: Zugriffsprotokoll aus `@ks/module-explorer/react` (Welle M4).
 *
 * Der Grund, warum das Modul hier die rohe Response liest statt `apiGet`:
 * `apiGet` wirft bei jedem Nicht-OK-Response und verschluckt damit den
 * Unterschied zwischen „abgelehnt" und „zu viele Anfragen". Diese Tests halten
 * genau diese Unterscheidung fest — und seit M5, dass jeder Request an die
 * hereingereichte Instanz geht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SAME_ORIGIN_API, createInstanceApi } from '@ks/api-client'
import { fetchAccessStatus, postAccessRequest } from '@ks/module-explorer/react'

function stubResponse(response: { ok: boolean; status?: number; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.body ?? {},
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchAccessStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { ...console, error: vi.fn() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reicht die Server-Antwort durch, wenn Zugriff besteht', async () => {
    stubResponse({ ok: true, body: { hasAccess: true } })

    expect(await fetchAccessStatus('lib-1', SAME_ORIGIN_API)).toEqual({ hasAccess: true })
  })

  it('kennzeichnet 429 als rateLimited und uebernimmt die Server-Meldung', async () => {
    stubResponse({ ok: false, status: 429, body: { message: 'Bitte spaeter erneut' } })

    const status = await fetchAccessStatus('lib-1', SAME_ORIGIN_API)

    expect(status.rateLimited).toBe(true)
    expect(status.message).toBe('Bitte spaeter erneut')
    expect(status.hasAccess).toBe(false)
  })

  it('unterscheidet eine gewoehnliche Ablehnung von 429', async () => {
    stubResponse({ ok: false, status: 403, body: { error: 'Keine Freigabe' } })

    const status = await fetchAccessStatus('lib-1', SAME_ORIGIN_API)

    expect(status.rateLimited).toBeUndefined()
    expect(status.message).toBe('Keine Freigabe')
  })

  it('benennt einen Netzwerkabbruch, statt ihn zu verschlucken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const status = await fetchAccessStatus('lib-1', SAME_ORIGIN_API)

    expect(status.hasAccess).toBe(false)
    expect(status.message).toBe('Fehler beim Prüfen des Zugriffs')
  })

  it('fragt die hereingereichte Instanz, nicht die eigene Herkunft (Embed, M5)', async () => {
    const fetchMock = stubResponse({ ok: true, body: { hasAccess: true } })

    await fetchAccessStatus('lib-1', createInstanceApi({ baseUrl: 'https://ks.example' }))

    expect(fetchMock).toHaveBeenCalledWith('https://ks.example/api/libraries/lib-1/access-check', {
      cache: 'no-store',
    })
  })
})

describe('postAccessRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('meldet den Wartezustand nach erfolgreicher Anfrage', async () => {
    stubResponse({ ok: true, body: {} })

    const status = await postAccessRequest('lib-1', SAME_ORIGIN_API)

    expect(status.status).toBe('pending')
    expect(status.hasAccess).toBe(false)
  })

  it('wirft bei Misserfolg — eine Nutzeraktion, die scheitert, ist ein Fehler', async () => {
    stubResponse({ ok: false, status: 400, body: { error: 'Bereits angefragt' } })

    await expect(postAccessRequest('lib-1', SAME_ORIGIN_API)).rejects.toThrow('Bereits angefragt')
  })
})
