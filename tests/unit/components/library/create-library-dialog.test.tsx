// @vitest-environment jsdom

/**
 * Characterization Tests fuer `CreateLibraryDialog` (Welle 3-I, Schritt 3).
 *
 * Fixiert:
 *
 * - Dialog rendert Titel + Name-Eingabe + Erstellen-Button (open=true).
 * - Clone-Checkbox erscheint nur, wenn eine aktive Library existiert.
 * - Cancel-Button ruft `onOpenChange(false)` auf.
 *
 * Keine echten API-Calls (`fetch` wird gemockt).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { CreateLibraryDialog } from '@/components/library/create-library-dialog'
import {
  activeLibraryIdAtom,
  librariesAtom,
} from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}))

function makeLibrary(overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id: 'lib-existing',
    label: 'Existing Library',
    type: 'local',
    path: '/tmp',
    isEnabled: true,
    config: {},
    ...overrides,
  } as ClientLibrary
}

describe('CreateLibraryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert Titel und Name-Eingabe, wenn open=true', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <CreateLibraryDialog open={true} onOpenChange={() => {}} />
      </Provider>
    )

    expect(screen.getByText('Neue Bibliothek erstellen')).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Erstellen/i })).toBeTruthy()
  })

  it('rendert nichts, wenn open=false', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <CreateLibraryDialog open={false} onOpenChange={() => {}} />
      </Provider>
    )

    expect(screen.queryByText('Neue Bibliothek erstellen')).toBeNull()
  })

  it('zeigt Clone-Checkbox NUR wenn eine aktive Library existiert', () => {
    // Ohne aktive Library → keine Clone-Option.
    const storeNoActive = createStore()
    storeNoActive.set(librariesAtom, [])
    storeNoActive.set(activeLibraryIdAtom, '')

    const { unmount } = render(
      <Provider store={storeNoActive}>
        <CreateLibraryDialog open={true} onOpenChange={() => {}} />
      </Provider>
    )
    expect(screen.queryByLabelText(/klonen/i)).toBeNull()
    unmount()

    // Mit aktiver Library → Clone-Option sichtbar.
    const storeActive = createStore()
    const lib = makeLibrary({ id: 'lib-1', label: 'Quelle' })
    storeActive.set(librariesAtom, [lib])
    storeActive.set(activeLibraryIdAtom, 'lib-1')

    render(
      <Provider store={storeActive}>
        <CreateLibraryDialog open={true} onOpenChange={() => {}} />
      </Provider>
    )
    expect(screen.getByText(/Konfiguration von/i)).toBeTruthy()
  })

  it('ruft onOpenChange(false) auf, wenn Abbrechen geklickt wird', () => {
    const onOpenChange = vi.fn()
    const store = createStore()
    render(
      <Provider store={store}>
        <CreateLibraryDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    )

    const cancelBtn = screen.getByRole('button', { name: /Abbrechen/i })
    fireEvent.click(cancelBtn)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
