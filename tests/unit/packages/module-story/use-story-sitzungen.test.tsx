// @vitest-environment jsdom

/**
 * `useStorySitzungen` — Sitzungen und Fragen fuer die Chronik (D1).
 *
 * Beweis-Ziele: Liste ueber die Instanz, Fragen erst beim Aufklappen,
 * Themenuebersicht (`queryType: 'toc'`) ist keine Frage der Person,
 * anonyme Betrachter schicken `X-Session-ID`, Umbenennen geht per PATCH,
 * Fehler bleiben sichtbar.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createInstanceApi } from '@ks/api-client'
import { useStorySitzungen } from '@ks/module-story/react'

interface Antwort { ok: boolean; status?: number; body?: unknown }

function stubFetch(routen: Record<string, Antwort>) {
  // Signatur wie `fetch` (url, init), damit `mock.calls` als [string, RequestInit] lesbar ist.
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const treffer = Object.keys(routen).find((fragment) => url.includes(fragment))
    if (!treffer) throw new Error(`Unerwarteter Request im Test: ${url}`)
    const r = routen[treffer]
    return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), json: async () => r.body ?? {} }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const instanz = createInstanceApi({ baseUrl: 'https://instanz.test' })

const chats = { items: [
  { chatId: 'c2', title: 'Heizen', createdAt: '2026-10-01T10:00:00.000Z' },
  { chatId: 'c1', title: 'Verkehr', createdAt: '2026-09-30T10:00:00.000Z' },
] }

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('useStorySitzungen', () => {
  it('laedt die Sitzungen ueber die Instanz, mit Sitzungskennung fuer Anonyme', async () => {
    const fetchMock = stubFetch({ '/chats?limit=50': { ok: true, body: chats } })
    const { result } = renderHook(() =>
      useStorySitzungen({ libraryId: 'lib', instanz, isSignedIn: false, aktiveChatId: null }),
    )
    await waitFor(() => expect(result.current.sitzungen).toHaveLength(2))
    expect(result.current.sitzungen[0]).toMatchObject({ chatId: 'c2', titel: 'Heizen', fragen: undefined })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://instanz.test/api/chat/lib/chats?limit=50')
    expect((init.headers as Record<string, string>)['X-Session-ID']).toMatch(/^anon-/)
  })

  it('angemeldete Betrachter schicken keine Sitzungskennung', async () => {
    const fetchMock = stubFetch({ '/chats?limit=50': { ok: true, body: chats } })
    renderHook(() => useStorySitzungen({ libraryId: 'lib', instanz, isSignedIn: true, aktiveChatId: null }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.headers).toEqual({})
  })

  it('laedt Fragen erst beim Aufklappen, laesst die Themenuebersicht weg und sortiert chronologisch', async () => {
    const fetchMock = stubFetch({
      '/chats?limit=50': { ok: true, body: chats },
      'chatId=c1': { ok: true, body: { items: [
        { queryId: 'q3', question: 'Dritte?', createdAt: '2026-09-30T12:00:00.000Z', status: 'pending' },
        { queryId: 'toc', question: 'What topics are covered here?', createdAt: '2026-09-30T09:00:00.000Z', status: 'ok', queryType: 'toc' },
        { queryId: 'q1', question: 'Erste?', shortTitle: 'Erste Frage', createdAt: '2026-09-30T10:00:00.000Z', status: 'ok', queryType: 'question' },
      ] } },
    })
    const { result } = renderHook(() =>
      useStorySitzungen({ libraryId: 'lib', instanz, isSignedIn: true, aktiveChatId: null }),
    )
    await waitFor(() => expect(result.current.sitzungen).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => result.current.fragenLaden('c1'))
    await act(() => result.current.fragenLaden('c1')) // idempotent
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const c1 = result.current.sitzungen.find((s) => s.chatId === 'c1')
    expect(c1?.fragen?.map((f) => f.queryId)).toEqual(['q1', 'q3'])
    expect(c1?.fragen?.[1].offen).toBe(true)
    // D5: Kurztitel des Sprachmodells kommt mit; alte Eintraege ohne bleiben ohne.
    expect(c1?.fragen?.map((f) => f.kurztitel)).toEqual(['Erste Frage', undefined])
  })

  it('umbenennen geht per PATCH und aktualisiert die Liste', async () => {
    const fetchMock = stubFetch({
      '/chats?limit=50': { ok: true, body: chats },
      '/chats/c2': { ok: true, body: { chatId: 'c2', title: 'Waerme' } },
    })
    const { result } = renderHook(() =>
      useStorySitzungen({ libraryId: 'lib', instanz, isSignedIn: true, aktiveChatId: null }),
    )
    await waitFor(() => expect(result.current.sitzungen).toHaveLength(2))

    await act(() => result.current.umbenennen('c2', '  Waerme '))
    const patch = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/chats/c2')) as [string, RequestInit]
    expect(patch[1].method).toBe('PATCH')
    expect(JSON.parse(String(patch[1].body))).toEqual({ title: 'Waerme' })
    expect(result.current.sitzungen[0].titel).toBe('Waerme')

    await expect(result.current.umbenennen('c2', '  ')).rejects.toThrow('Titel darf nicht leer sein')
  })

  it('haelt Fehler sichtbar statt eine leere Liste vorzutaeuschen', async () => {
    stubFetch({ '/chats?limit=50': { ok: false, status: 503 } })
    const { result } = renderHook(() =>
      useStorySitzungen({ libraryId: 'lib', instanz, isSignedIn: true, aktiveChatId: null }),
    )
    await waitFor(() => expect(result.current.fehler).toBe('Sitzungen laden: HTTP 503'))
    expect(result.current.ladend).toBe(false)
  })

  it('laedt neu, wenn die App eine Sitzung aktiviert, die noch nicht in der Liste steht', async () => {
    const fetchMock = stubFetch({ '/chats?limit=50': { ok: true, body: chats } })
    const { result, rerender } = renderHook(
      ({ aktiv }: { aktiv: string | null }) =>
        useStorySitzungen({ libraryId: 'lib', instanz, isSignedIn: true, aktiveChatId: aktiv }),
      { initialProps: { aktiv: null as string | null } },
    )
    await waitFor(() => expect(result.current.sitzungen).toHaveLength(2))
    rerender({ aktiv: 'c2' }) // bekannt — kein Nachladen
    rerender({ aktiv: 'c-neu' }) // unbekannt — Nachladen
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
