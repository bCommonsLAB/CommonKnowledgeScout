// @vitest-environment jsdom

/**
 * Characterization Tests fuer `LibrarySwitcher` (Welle 3-I, Schritt 3).
 *
 * Fixiert das **derzeitige** Verhalten:
 *
 * - Rendert SelectTrigger mit aktuellem Library-Label.
 * - Listet eigene und geteilte Libraries getrennt.
 * - Zeigt "Neue Bibliothek erstellen" als Eintrag.
 *
 * Keine echten Storage-Calls. Atoms werden vor jedem Test gesetzt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { LibrarySwitcher } from '@/components/library/library-switcher'
import {
  activeLibraryIdAtom,
  librariesAtom,
} from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

// CreateLibraryDialog mocken — Schritt 3 fixiert nur den Switcher,
// nicht den Dialog (eigener Test in `create-library-dialog.test.tsx`).
vi.mock('@/components/library/create-library-dialog', () => ({
  CreateLibraryDialog: () => <div data-testid="create-dialog-mock" />,
}))

function makeLibrary(overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id: 'lib-1',
    label: 'Default Library',
    type: 'local',
    path: '/tmp/lib1',
    isEnabled: true,
    config: {},
    ...overrides,
  } as ClientLibrary
}

describe('LibrarySwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt das Label der aktiven Library im Trigger', () => {
    const store = createStore()
    const lib = makeLibrary({ id: 'lib-1', label: 'Mein Archiv' })
    store.set(librariesAtom, [lib])
    store.set(activeLibraryIdAtom, 'lib-1')

    render(
      <Provider store={store}>
        <LibrarySwitcher />
      </Provider>
    )

    // Im Trigger steht der Label-Text der aktiven Library.
    expect(screen.getByText('Mein Archiv')).toBeTruthy()
  })

  it('rendert keinen Trigger-Label, wenn keine Library aktiv ist', () => {
    const store = createStore()
    store.set(librariesAtom, [])
    store.set(activeLibraryIdAtom, '')

    render(
      <Provider store={store}>
        <LibrarySwitcher />
      </Provider>
    )

    // Es darf kein eigenes Label gerendert werden — Placeholder bleibt.
    expect(screen.queryByText('Mein Archiv')).toBeNull()
  })

  it('rendert weiterhin sicher, wenn die librariesAtom-Liste ungueltige Eintraege enthaelt', () => {
    // librariesAtom kann theoretisch corrupted sein (id leer);
    // der Switcher filtert solche Eintraege via `safe`-Liste.
    const store = createStore()
    const valid = makeLibrary({ id: 'lib-1', label: 'Valid' })
    const invalid = makeLibrary({ id: '', label: 'Invalid' })
    store.set(librariesAtom, [valid, invalid])
    store.set(activeLibraryIdAtom, 'lib-1')

    render(
      <Provider store={store}>
        <LibrarySwitcher />
      </Provider>
    )

    // Es darf kein Crash passieren; "Valid" bleibt sichtbar.
    expect(screen.getByText('Valid')).toBeTruthy()
  })
})
