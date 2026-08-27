/**
 * @fileoverview Unit-Tests: `@ks/api-client/http` (Welle M2).
 *
 * Kein stiller Fallback (no-silent-fallbacks.md): ein Nicht-OK-Response muss
 * immer einen `Error` werfen, mit der Server-Fehlermeldung wenn vorhanden.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch, apiGet, apiPost } from '@ks/api-client'

describe('@ks/api-client/http', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gibt das geparste JSON zurueck, wenn die Response ok ist', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: 'world' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiGet<{ hello: string }>('/api/example')

    expect(result).toEqual({ hello: 'world' })
    expect(fetchMock).toHaveBeenCalledWith('/api/example', undefined)
  })

  it('wirft die Server-Fehlermeldung bei Nicht-OK-Response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Datenbank nicht erreichbar' }),
    }))

    await expect(apiGet('/api/example')).rejects.toThrow('Datenbank nicht erreichbar')
  })

  it('faellt auf eine generische HTTP-Fehlermeldung zurueck, wenn kein JSON-Body vorliegt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => { throw new Error('kein Body') },
    }))

    await expect(apiGet('/api/example')).rejects.toThrow('HTTP-Fehler: 404')
  })

  it('apiPost sendet JSON-Body mit POST-Methode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await apiPost('/api/example', { foo: 'bar' })

    expect(fetchMock).toHaveBeenCalledWith('/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    })
  })

  it('haengt baseUrl aus der Config vor den Pfad', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/api/example', undefined, { baseUrl: 'https://remote.example' })

    expect(fetchMock).toHaveBeenCalledWith('https://remote.example/api/example', undefined)
  })
})
