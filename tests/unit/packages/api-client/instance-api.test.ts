/**
 * Unit-Tests: die Instanz, gegen die ein Modul spricht (`@ks/api-client`, M5).
 *
 * Im Embed laeuft die Galerie in einer fremden Seite. Jeder Request, der die
 * Basis-URL verliert, landet still auf dem Server von AECED statt auf der
 * Instanz — deshalb prueft die Basis-URL laut und der Pfad muss mit `/`
 * beginnen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { SAME_ORIGIN_API, apiUrl, createInstanceApi } from '@ks/api-client'

describe('createInstanceApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gleiche Herkunft: der Pfad bleibt relativ', () => {
    expect(SAME_ORIGIN_API.baseUrl).toBe('')
    expect(SAME_ORIGIN_API.url('/api/chat/lib-1/docs')).toBe('/api/chat/lib-1/docs')
  })

  it('setzt die Basis-URL vor den Pfad und kappt den Schraegstrich am Ende', () => {
    const instanz = createInstanceApi({ baseUrl: 'https://knowledgescout.org/' })
    expect(instanz.baseUrl).toBe('https://knowledgescout.org')
    expect(instanz.url('/api/chat/lib-1/docs')).toBe('https://knowledgescout.org/api/chat/lib-1/docs')
  })

  it('haelt einen Pfad-Praefix der Instanz', () => {
    const instanz = createInstanceApi({ baseUrl: 'https://example.org/ks' })
    expect(instanz.url('/api/x')).toBe('https://example.org/ks/api/x')
  })

  it.each([
    ['ohne Schema', 'knowledgescout.org'],
    ['fremdes Schema', 'ftp://knowledgescout.org'],
    ['mit Query', 'https://knowledgescout.org?a=1'],
    ['mit Fragment', 'https://knowledgescout.org#x'],
  ])('weist eine Basis-URL %s ab, statt sie still zu uebernehmen', (_fall, baseUrl) => {
    expect(() => createInstanceApi({ baseUrl })).toThrow(/Basis-URL/)
  })

  it('weist einen Pfad ohne fuehrenden Schraegstrich ab', () => {
    expect(() => SAME_ORIGIN_API.url('api/x')).toThrow(/muss mit "\/" beginnen/)
    expect(() => apiUrl('api/x')).toThrow(/muss mit "\/" beginnen/)
  })

  it('fetch geht an die Instanz und reicht die Response unveraendert durch', async () => {
    // Erst NACH dem Erzeugen stubben: `fetch` wird beim Aufruf nachgeschlagen.
    const instanz = createInstanceApi({ baseUrl: 'https://ks.example' })
    const antwort = { ok: false, status: 429 }
    const fetchMock = vi.fn().mockResolvedValue(antwort)
    vi.stubGlobal('fetch', fetchMock)

    const res = await instanz.fetch('/api/libraries/lib-1/access-check', { cache: 'no-store' })

    expect(fetchMock).toHaveBeenCalledWith('https://ks.example/api/libraries/lib-1/access-check', {
      cache: 'no-store',
    })
    expect(res).toBe(antwort)
  })

  it('schickt die Sprache als Accept-Language mit (Embed, M5)', async () => {
    const instanz = createInstanceApi({ baseUrl: 'https://ks.example', acceptLanguage: 'it' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await instanz.fetch('/api/chat/lib-1/docs', { cache: 'no-store' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('Accept-Language')).toBe('it')
    expect(init.cache).toBe('no-store')
  })

  it('ein ausdruecklich gesetzter Accept-Language der Anfrage bleibt stehen', async () => {
    const instanz = createInstanceApi({ baseUrl: 'https://ks.example', acceptLanguage: 'it' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await instanz.fetch('/api/x', { headers: { 'Accept-Language': 'de' } })

    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Accept-Language')).toBe('de')
  })

  it('ohne Sprache reicht sie init unveraendert durch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const init = { cache: 'no-store' as const }

    await SAME_ORIGIN_API.fetch('/api/x', init)

    expect(fetchMock.mock.calls[0][1]).toBe(init)
  })

  it('weist eine leere Sprache ab', () => {
    expect(() => createInstanceApi({ baseUrl: '', acceptLanguage: ' ' })).toThrow(/acceptLanguage/)
  })
})
