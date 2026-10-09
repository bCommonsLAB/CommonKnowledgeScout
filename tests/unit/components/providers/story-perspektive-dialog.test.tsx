// @vitest-environment jsdom

/**
 * Die Perspektiv-Wahl beim Betreten des Story-Modus (Owner 09.10.2026):
 * Ohne Eintrag „Perspektive gewaehlt" im Browser oeffnet sich der Dialog.
 * Speichern oder Wegklicken setzt den Eintrag, danach fragt er nicht mehr.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { storyPerspektiveDialogOffenAtom } from '@/atoms/story-perspektive-dialog-atom'
import { StoryPerspektiveDialog, STORY_PERSPECTIVE_SET_FLAG, perspektiveErfragen } from '@/components/providers/story-perspektive-dialog'

let currentSearch = ''
const profil = { stand: 'fertig' as 'laedt' | 'fertig', speichern: vi.fn(), aktuelleSpeichern: vi.fn() }

// Das Profil (angemeldet) hat eigene Tests an der Route; hier zaehlt, wann der Dialog es befragt.
vi.mock('@/hooks/use-profil-perspektive', () => ({ useProfilPerspektive: () => profil }))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

// Der Dialog selbst hat eigene Tests im Paket; hier zaehlt, ob er montiert wird
// und was beim Schliessen passiert.
vi.mock('@/components/library/story/perspektive-dialog-app', () => ({
  PerspektiveDialogApp: ({ onOpenChange }: { onOpenChange: (offen: boolean) => void }) => (
    <button data-testid="perspektive-dialog" onClick={() => onOpenChange(false)}>schliessen</button>
  ),
}))

function montieren(search: string) {
  currentSearch = search
  const store = createStore()
  const ansicht = render(
    <JotaiProvider store={store}>
      <StoryPerspektiveDialog />
    </JotaiProvider>,
  )
  return { store, ansicht }
}

beforeEach(() => {
  localStorage.removeItem(STORY_PERSPECTIVE_SET_FLAG)
  profil.stand = 'fertig'
  profil.aktuelleSpeichern.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('perspektiveErfragen', () => {
  const p = (s: string) => new URLSearchParams(s)
  it('Story-Modus ohne Eintrag: fragen — auch mit der Voreinstellung „nicht festgelegt"', () => expect(perspektiveErfragen(p('mode=story'), null)).toBe(true))
  it('Eintrag im Browser: nicht mehr fragen', () => expect(perspektiveErfragen(p('mode=story'), 'true')).toBe(false))
  it('nicht im Story-Modus — auch nicht bei view=gallery&mode=story', () => {
    expect(perspektiveErfragen(p(''), null)).toBe(false)
    expect(perspektiveErfragen(p('view=gallery&mode=story'), null)).toBe(false)
  })
})

describe('StoryPerspektiveDialog', () => {
  it('oeffnet beim ersten Betreten', () => {
    const { ansicht } = montieren('mode=story')
    expect(ansicht.queryByTestId('perspektive-dialog')).not.toBeNull()
  })

  it('Wegklicken setzt den Eintrag — beim naechsten Besuch kein Dialog', () => {
    const { ansicht } = montieren('mode=story')
    fireEvent.click(ansicht.getByTestId('perspektive-dialog'))
    expect(ansicht.queryByTestId('perspektive-dialog')).toBeNull()
    expect(localStorage.getItem(STORY_PERSPECTIVE_SET_FLAG)).toBe('true')
    cleanup()
    const zweiter = montieren('mode=story')
    expect(zweiter.ansicht.queryByTestId('perspektive-dialog')).toBeNull()
  })

  it('Wegklicken beim ersten Mal legt die Voreinstellung ins Profil; spaeteres Schliessen nicht mehr', () => {
    const { store, ansicht } = montieren('mode=story')
    fireEvent.click(ansicht.getByTestId('perspektive-dialog'))
    expect(profil.aktuelleSpeichern).toHaveBeenCalledTimes(1)
    act(() => store.set(storyPerspektiveDialogOffenAtom, true))
    fireEvent.click(ansicht.getByTestId('perspektive-dialog'))
    expect(profil.aktuelleSpeichern).toHaveBeenCalledTimes(1)
  })

  it('angemeldet: wartet, bis das Profil geladen ist — es kann den Eintrag mitbringen', () => {
    profil.stand = 'laedt'
    const { ansicht } = montieren('mode=story')
    expect(ansicht.queryByTestId('perspektive-dialog')).toBeNull()
  })

  it('mit Eintrag bleibt er zu; der Knopf oeffnet ueber das Atom', () => {
    localStorage.setItem(STORY_PERSPECTIVE_SET_FLAG, 'true')
    const { store, ansicht } = montieren('mode=story')
    expect(ansicht.queryByTestId('perspektive-dialog')).toBeNull()
    act(() => store.set(storyPerspektiveDialogOffenAtom, true))
    expect(ansicht.queryByTestId('perspektive-dialog')).not.toBeNull()
  })
})
