// @vitest-environment jsdom

/**
 * `useActiveChatId` — seit D1 ueber ein Atom geteilt: Chat-Panel (Mitte) und
 * Chronik (links) sind getrennte Slots und muessen dieselbe Sitzung sehen.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { useActiveChatId } from '@/components/library/chat/chat-panel/hooks/use-active-chat-id'

function wrapperFuer(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

afterEach(() => localStorage.clear())

describe('useActiveChatId', () => {
  it('liest die gespeicherte Sitzung einmal aus localStorage', async () => {
    localStorage.setItem('chat-activeChatId-lib', 'c1')
    const { result } = renderHook(() => useActiveChatId('lib'), { wrapper: wrapperFuer(createStore()) })
    await waitFor(() => expect(result.current.activeChatId).toBe('c1'))
  })

  it('zwei Instanzen im selben Store sehen dieselbe Sitzung; der Setter persistiert', async () => {
    const store = createStore()
    const wrapper = wrapperFuer(store)
    const panel = renderHook(() => useActiveChatId('lib'), { wrapper })
    const chronik = renderHook(() => useActiveChatId('lib'), { wrapper })
    await waitFor(() => expect(panel.result.current.activeChatId).toBeNull())

    act(() => chronik.result.current.setActiveChatId('c2'))
    expect(panel.result.current.activeChatId).toBe('c2')
    expect(localStorage.getItem('chat-activeChatId-lib')).toBe('c2')

    act(() => panel.result.current.setActiveChatId(null))
    expect(chronik.result.current.activeChatId).toBeNull()
    expect(localStorage.getItem('chat-activeChatId-lib')).toBeNull()
  })

  it('haelt Libraries auseinander', async () => {
    localStorage.setItem('chat-activeChatId-a', 'ca')
    const wrapper = wrapperFuer(createStore())
    const a = renderHook(() => useActiveChatId('a'), { wrapper })
    const b = renderHook(() => useActiveChatId('b'), { wrapper })
    await waitFor(() => expect(a.result.current.activeChatId).toBe('ca'))
    expect(b.result.current.activeChatId).toBeNull()
  })
})
