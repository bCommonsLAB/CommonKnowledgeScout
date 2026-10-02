// @vitest-environment jsdom

/**
 * `useStorySitzungen` ohne Library-Kennung (D9): Die Schale montiert die
 * Chronik, bevor die Library bekannt ist. Dann darf kein Aufruf ins Leere
 * gehen (`GET /api/chat//chats` → 405, Befund 02.10.). Sobald die Kennung da
 * ist, laedt der Hook wie gewohnt.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createInstanceApi } from '@ks/api-client'
import { useStorySitzungen } from '@ks/module-story/react'

const instanz = createInstanceApi({ baseUrl: 'https://instanz.test' })

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('useStorySitzungen ohne Library-Kennung', () => {
  it('ruft nichts auf, solange die Kennung leer ist, und laedt danach', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ chatId: 'c1', title: 'Heizen', createdAt: '2026-10-01T10:00:00.000Z' }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { result, rerender } = renderHook(
      ({ libraryId }: { libraryId: string }) =>
        useStorySitzungen({ libraryId, instanz, isSignedIn: true, aktiveChatId: null }),
      { initialProps: { libraryId: '' } },
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.sitzungen).toEqual([])
    expect(result.current.fehler).toBeNull()

    await result.current.fragenLaden('c1')
    expect(fetchMock).not.toHaveBeenCalled()

    rerender({ libraryId: 'lib' })
    await waitFor(() => expect(result.current.sitzungen).toHaveLength(1))
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://instanz.test/api/chat/lib/chats?limit=50')
  })
})
