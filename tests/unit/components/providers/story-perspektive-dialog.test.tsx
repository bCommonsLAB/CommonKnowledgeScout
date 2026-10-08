// @vitest-environment jsdom

/**
 * Die Perspektiv-Wahl beim Betreten des Story-Modus (09.10.2026): ein Dialog
 * statt des Sprungs zur Perspektiv-Seite. Die Bedingung ist die alte aus
 * `StoryPerspectiveRedirect` (M4h); neu ist nur, dass der Dialog sich oeffnet
 * und je Montage hoechstens einmal fragt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { storyCharacterAtom } from '@/atoms/story-context-atom'
import { storyPerspektiveDialogOffenAtom } from '@/atoms/story-perspektive-dialog-atom'
import { StoryPerspektiveDialog, STORY_PERSPECTIVE_SET_FLAG, perspektiveErfragen } from '@/components/providers/story-perspektive-dialog'

let currentSearch = ''

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

// Der Dialog selbst hat eigene Tests im Paket; hier zaehlt, ob er montiert wird.
vi.mock('@/components/library/story/perspektive-dialog-app', () => ({
  PerspektiveDialogApp: () => <div data-testid="perspektive-dialog" />,
}))

function montieren(search: string, character: string[]) {
  currentSearch = search
  const store = createStore()
  store.set(storyCharacterAtom, character as never)
  const ansicht = render(
    <JotaiProvider store={store}>
      <StoryPerspektiveDialog />
    </JotaiProvider>,
  )
  return { store, ansicht }
}

beforeEach(() => {
  localStorage.removeItem(STORY_PERSPECTIVE_SET_FLAG)
})

afterEach(() => {
  cleanup()
})

describe('perspektiveErfragen', () => {
  const p = (s: string) => new URLSearchParams(s)
  it('Story-Modus ohne Perspektive: fragen', () => expect(perspektiveErfragen(p('mode=story'), [], null)).toBe(true))
  it('nur Default-Perspektive zaehlt wie keine', () => expect(perspektiveErfragen(p('mode=story'), ['business'], null)).toBe(true))
  it('gesetzte Perspektive: nicht fragen', () => expect(perspektiveErfragen(p('mode=story'), ['ecology'], null)).toBe(false))
  it('Flag im localStorage: nur einmal fragen', () => expect(perspektiveErfragen(p('mode=story'), [], 'true')).toBe(false))
  it('nicht im Story-Modus — auch nicht bei view=gallery&mode=story', () => {
    expect(perspektiveErfragen(p(''), [], null)).toBe(false)
    expect(perspektiveErfragen(p('view=gallery&mode=story'), [], null)).toBe(false)
  })
})

describe('StoryPerspektiveDialog', () => {
  it('oeffnet beim Betreten ohne Perspektive', () => {
    const { ansicht } = montieren('mode=story', [])
    expect(ansicht.queryByTestId('perspektive-dialog')).not.toBeNull()
  })

  it('bleibt zu, wenn die Perspektive gesetzt ist; der Knopf oeffnet ueber das Atom', () => {
    const { store, ansicht } = montieren('mode=story', ['ecology'])
    expect(ansicht.queryByTestId('perspektive-dialog')).toBeNull()
    act(() => store.set(storyPerspektiveDialogOffenAtom, true))
    expect(ansicht.queryByTestId('perspektive-dialog')).not.toBeNull()
  })

  it('fragt je Montage hoechstens einmal: geschlossen bleibt geschlossen', () => {
    const { store, ansicht } = montieren('mode=story', [])
    act(() => store.set(storyPerspektiveDialogOffenAtom, false))
    act(() => store.set(storyCharacterAtom, ['business'] as never))
    expect(ansicht.queryByTestId('perspektive-dialog')).toBeNull()
  })
})
