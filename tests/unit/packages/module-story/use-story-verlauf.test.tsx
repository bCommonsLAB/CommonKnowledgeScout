// @vitest-environment jsdom

/**
 * `useStoryVerlauf` (D6b): eine Anfrage je Sitzung ueber die Instanz, Verlauf
 * unter lokale Nachrichten gemischt; 404 ist kein Fehler; „Neue Sitzung"
 * leert den Verlauf; ein Serverfehler wird gemeldet. D12c: Der Wechsel in
 * eine andere Sitzung laesst die gespeicherten Nachrichten der alten fallen,
 * die erste Kennung nach `null` behaelt alles.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createInstanceApi } from '@ks/api-client'
import { useStoryVerlauf } from '@ks/module-story/react'

afterEach(() => vi.unstubAllGlobals())

const eintrag = { queryId: 'q1', question: 'Frage', createdAt: '2026-10-01T10:00:00.000Z', answer: 'Antwort' }

function montieren(fetchMock: ReturnType<typeof vi.fn>, chatId: string | null) {
  vi.stubGlobal('fetch', fetchMock)
  const instanz = createInstanceApi({ baseUrl: 'https://ks.example' })
  return renderHook(({ id }: { id: string | null }) => useStoryVerlauf({ libraryId: 'lib', instanz, isSignedIn: true, chatId: id }), {
    initialProps: { id: chatId },
  })
}

describe('useStoryVerlauf', () => {
  it('laedt die Liste der Sitzung und behaelt lokale Nachrichten', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [eintrag] }) }))
    const hook = montieren(fetchMock, 'c1')
    act(() => hook.result.current.setNachrichten([{ id: 'question-1', art: 'frage', text: 'Lokal', createdAt: '2026-10-01T11:00:00.000Z' }]))
    await waitFor(() => expect(hook.result.current.nachrichten).toHaveLength(3))
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe('https://ks.example/api/chat/lib/queries?limit=100&chatId=c1')
    expect(hook.result.current.nachrichten.map((m) => m.id)).toEqual(['q1-question', 'q1-answer', 'question-1'])
    expect(hook.result.current.fehler).toBeNull()
  })

  it('404 ist kein Fehler; „Neue Sitzung" leert; Serverfehler wird gemeldet', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const hook = montieren(fetchMock, 'c1')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(hook.result.current.fehler).toBeNull()
    act(() => hook.result.current.setNachrichten([{ id: 'question-1', art: 'frage', text: 'Lokal', createdAt: '2026-10-01T11:00:00.000Z' }]))
    hook.rerender({ id: null })
    expect(hook.result.current.nachrichten).toEqual([])
    hook.rerender({ id: 'c2' })
    await waitFor(() => expect(hook.result.current.fehler).toBe('Verlauf laden: HTTP 500'))
  })

  it('Wechsel A→B laesst die gespeicherten Nachrichten von A fallen, Lokales ohne Kennung bleibt', async () => {
    const eintragB = { ...eintrag, queryId: 'q2', question: 'Frage B', createdAt: '2026-10-01T12:00:00.000Z' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [eintrag] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [eintragB] }) })
    const hook = montieren(fetchMock, 'c1')
    await waitFor(() => expect(hook.result.current.nachrichten).toHaveLength(2))
    act(() => hook.result.current.setNachrichten((alt) => [...alt, { id: 'question-1', art: 'frage', text: 'Laeuft', createdAt: '2026-10-01T13:00:00.000Z' }]))
    hook.rerender({ id: 'c2' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(hook.result.current.nachrichten.map((m) => m.id)).toEqual(['q2-question', 'q2-answer', 'question-1']))
  })

  it('erste Kennung nach „Neue Sitzung" behaelt die Nachrichten der eroeffnenden Frage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    const hook = montieren(fetchMock, null)
    act(() =>
      hook.result.current.setNachrichten([
        { id: 'question-1', art: 'frage', text: 'Erste', createdAt: '2026-10-01T11:00:00.000Z', queryId: 'q9' },
        { id: 'q9-answer', art: 'antwort', text: 'Antwort', createdAt: '2026-10-01T11:00:01.000Z', queryId: 'q9' },
      ]),
    )
    hook.rerender({ id: 'c-neu' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(hook.result.current.nachrichten.map((m) => m.id)).toEqual(['question-1', 'q9-answer'])
  })
})
