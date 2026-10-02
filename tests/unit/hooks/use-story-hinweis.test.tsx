// @vitest-environment jsdom

/**
 * `useStoryHinweis` (D10): Der Hinweis ist beim ersten Besuch offen, „Verstanden"
 * merkt es im Browser und schliesst ihn, „zeigen" holt ihn zurueck; Kopf und
 * Mitte teilen sich den Zustand ueber das Atom.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { STORY_HINWEIS_GESEHEN_KEY, useStoryHinweis } from '@/hooks/use-story-hinweis'

afterEach(() => localStorage.clear())

function mitStore(store = createStore()) {
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>
  return { wrapper, store }
}

describe('useStoryHinweis', () => {
  it('offen beim ersten Besuch; Verstanden merkt und schliesst; zeigen holt zurueck', () => {
    const { wrapper } = mitStore()
    const { result } = renderHook(() => useStoryHinweis(), { wrapper })
    expect(result.current.offen).toBe(true)

    act(() => result.current.verstanden())
    expect(result.current.offen).toBe(false)
    expect(localStorage.getItem(STORY_HINWEIS_GESEHEN_KEY)).toBe('true')

    act(() => result.current.zeigen())
    expect(result.current.offen).toBe(true)
  })

  it('bleibt zu, wenn der Browser ihn schon gesehen hat; zwei Hooks teilen den Zustand', () => {
    localStorage.setItem(STORY_HINWEIS_GESEHEN_KEY, 'true')
    const { wrapper } = mitStore()
    const kopf = renderHook(() => useStoryHinweis(), { wrapper })
    const mitte = renderHook(() => useStoryHinweis(), { wrapper })
    expect(mitte.result.current.offen).toBe(false)

    act(() => kopf.result.current.zeigen())
    expect(mitte.result.current.offen).toBe(true)
  })
})
