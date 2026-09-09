// @vitest-environment jsdom

/**
 * Der Sprung zur Perspektiven-Wahl, festgehalten (Welle M4h).
 *
 * Bis M4h lag die Regel als Effekt in `gallery-root` und las dafuer
 * `storyCharacterAtom` — Story-Zustand, der die Galerie an das ganze
 * Chat-Vokabular band. Jetzt entscheidet die App in `StoryPerspectiveRedirect`;
 * die Faelle hier sind die aus dem alten Effekt, unveraendert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { storyCharacterAtom } from '@/atoms/story-context-atom'
import { StoryPerspectiveRedirect, STORY_PERSPECTIVE_SET_FLAG } from '@/components/providers/story-perspective-redirect'

let currentPath: string | null = '/library/gallery'
let currentSearch = ''
let activeLibraryId = 'lib-1'
const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => currentPath,
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

vi.mock('@ks/shell/react', () => ({
  useActiveLibraryId: () => activeLibraryId,
}))

/** Die Weiche unter einer Adresse mit einer bestimmten Perspektive montieren. */
function montieren(path: string, search: string, character: string[]) {
  currentPath = path
  currentSearch = search
  const store = createStore()
  store.set(storyCharacterAtom, character as never)
  render(
    <JotaiProvider store={store}>
      <StoryPerspectiveRedirect />
    </JotaiProvider>
  )
}

beforeEach(() => {
  push.mockClear()
  activeLibraryId = 'lib-1'
  localStorage.removeItem(STORY_PERSPECTIVE_SET_FLAG)
})

afterEach(() => {
  cleanup()
})

describe('StoryPerspectiveRedirect', () => {
  it('ohne Perspektive auf /explore: zur Perspektiven-Seite des Slugs', () => {
    montieren('/explore/sfscon', 'mode=story', [])
    expect(push).toHaveBeenCalledWith('/explore/sfscon/perspective')
  })

  it('nur Default-Perspektive zaehlt wie keine', () => {
    montieren('/explore/sfscon', 'mode=story', ['business'])
    expect(push).toHaveBeenCalledWith('/explore/sfscon/perspective')
  })

  it('auf /library/gallery mit libraryId und Herkunft, bestehende Parameter bleiben', () => {
    montieren('/library/gallery', 'mode=story&sort=stars', [])
    expect(push).toHaveBeenCalledWith('/library/gallery/perspective?mode=story&sort=stars&libraryId=lib-1&from=story')
  })

  it('auf /library/gallery ohne libraryId gibt es nichts zu springen', () => {
    activeLibraryId = ''
    montieren('/library/gallery', 'mode=story', [])
    expect(push).not.toHaveBeenCalled()
  })

  it('gesetzte Perspektive: kein Sprung', () => {
    montieren('/explore/sfscon', 'mode=story', ['technical'])
    expect(push).not.toHaveBeenCalled()
  })

  it('Flag im localStorage: nur einmal fragen', () => {
    localStorage.setItem(STORY_PERSPECTIVE_SET_FLAG, '1')
    montieren('/explore/sfscon', 'mode=story', [])
    expect(push).not.toHaveBeenCalled()
  })

  it('nicht im Story-Modus: kein Sprung — auch nicht bei view=gallery&mode=story', () => {
    montieren('/explore/sfscon', '', [])
    montieren('/explore/sfscon', 'view=gallery&mode=story', [])
    expect(push).not.toHaveBeenCalled()
  })

  it('von der Perspektiven-Seite selbst nie — sonst Schleife', () => {
    montieren('/explore/sfscon/perspective', 'mode=story', [])
    montieren('/library/gallery/perspective', 'mode=story', [])
    expect(push).not.toHaveBeenCalled()
  })
})
