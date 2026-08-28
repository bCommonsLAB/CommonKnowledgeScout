/**
 * Unit-Tests: Zugriffsprotokoll aus `@ks/module-explorer/react` (Welle M4).
 *
 * Der Grund, warum das Modul hier eigenes `fetch` benutzt statt `@ks/api-client`:
 * `apiGet` wirft bei jedem Nicht-OK-Response und verschluckt damit den
 * Unterschied zwischen „abgelehnt" und „zu viele Anfragen". Diese Tests halten
 * genau diese Unterscheidung fest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

    expect(await fetchAccessStatus('lib-1')).toEqual({ hasAccess: true })
  })

  it('kennzeichnet 429 als rateLimited und uebernimmt die Server-Meldung', async () => {
    stubResponse({ ok: false, status: 429, body: { message: 'Bitte spaeter erneut' } })

    const status = await fetchAccessStatus('lib-1')

    expect(status.rateLimited).toBe(true)
    expect(status.message).toBe('Bitte spaeter erneut')
    expect(status.hasAccess).toBe(false)
  })

  it('unterscheidet eine gewoehnliche Ablehnung von 429', async () => {
    stubResponse({ ok: false, status: 403, body: { error: 'Keine Freigabe' } })

    const status = await fetchAccessStatus('lib-1')

    expect(status.rateLimited).toBeUndefined()
    expect(status.message).toBe('Keine Freigabe')
  })

  it('benennt einen Netzwerkabbruch, statt ihn zu verschlucken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const status = await fetchAccessStatus('lib-1')

    expect(status.hasAccess).toBe(false)
    expect(status.message).toBe('Fehler beim Prüfen des Zugriffs')
  })
})

describe('postAccessRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('meldet den Wartezustand nach erfolgreicher Anfrage', async () => {
    stubResponse({ ok: true, body: {} })

    const status = await postAccessRequest('lib-1')

    expect(status.status).toBe('pending')
    expect(status.hasAccess).toBe(false)
  })

  it('wirft bei Misserfolg — eine Nutzeraktion, die scheitert, ist ein Fehler', async () => {
    stubResponse({ ok: false, status: 400, body: { error: 'Bereits angefragt' } })

    await expect(postAccessRequest('lib-1')).rejects.toThrow('Bereits angefragt')
  })
})
