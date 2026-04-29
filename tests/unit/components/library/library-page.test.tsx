// @vitest-environment jsdom

/**
 * Characterization Tests fuer die Library-Page (`src/app/library/page.tsx`).
 *
 * Fixiert die Status-Branches der Page (siehe Contract §4):
 *
 * - `!isAuthLoaded` oder `isLoading` → Skeleton-Loader.
 * - `isLoaded && !isSignedIn` → Auth-Fehlermeldung.
 * - `error !== null` → Error-Alert.
 * - `libraries.length === 0 && signed in` → "Keine Bibliotheken vorhanden"-Card.
 * - Sonst → Library-Komponente.
 *
 * Sub-Komponenten und Hooks werden gemockt; der Test prueft nur die
 * Status-Logik der Page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import {
  activeLibraryIdAtom,
  librariesAtom,
} from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'

const mockUseAuth = vi.fn()
const mockUseStorage = vi.fn()

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/contexts/storage-context', async (orig) => {
  const actual = await orig<typeof import('@/contexts/storage-context')>()
  return {
    ...actual,
    useStorage: () => mockUseStorage(),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

// Library-Komponente mocken — die Page-Tests sollen NUR Status-Branches
// pruefen, nicht das gesamte Library-Render-Subtree.
vi.mock('@/components/library/library', () => ({
  Library: () => <div data-testid="library-component" />,
}))

import LibraryPage from '@/app/library/page'

function makeLibrary(): ClientLibrary {
  return {
    id: 'lib-1',
    label: 'Test Library',
    type: 'local',
    path: '/tmp',
    isEnabled: true,
    config: {},
  } as ClientLibrary
}

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt Skeleton, wenn Auth noch nicht geladen ist', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false })
    mockUseStorage.mockReturnValue({
      isLoading: true,
      error: null,
      refreshAuthStatus: vi.fn(),
    })
    const store = createStore()
    store.set(librariesAtom, [])
    store.set(activeLibraryIdAtom, '')

    const { container } = render(
      <Provider store={store}>
        <LibraryPage />
      </Provider>
    )

    // Skeleton hat data-* nicht, aber wir pruefen, dass kein Library-
    // Component geladen wird.
    expect(screen.queryByTestId('library-component')).toBeNull()
    // Es muss zumindest etwas gerendert werden (Skeleton-Container).
    expect(container.firstChild).toBeTruthy()
  })

  it('zeigt Auth-Fehler, wenn nicht angemeldet', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false })
    mockUseStorage.mockReturnValue({
      isLoading: false,
      error: null,
      refreshAuthStatus: vi.fn(),
    })
    const store = createStore()
    store.set(librariesAtom, [])

    render(
      <Provider store={store}>
        <LibraryPage />
      </Provider>
    )

    expect(screen.getByText(/angemeldet sein/i)).toBeTruthy()
    expect(screen.queryByTestId('library-component')).toBeNull()
  })

  it('zeigt Storage-Fehler, wenn error gesetzt ist', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    mockUseStorage.mockReturnValue({
      isLoading: false,
      error: 'Storage konnte nicht initialisiert werden',
      refreshAuthStatus: vi.fn(),
    })
    const store = createStore()
    store.set(librariesAtom, [])

    render(
      <Provider store={store}>
        <LibraryPage />
      </Provider>
    )

    expect(screen.getByText('Storage konnte nicht initialisiert werden')).toBeTruthy()
  })

  it('zeigt "Keine Bibliotheken"-Card, wenn signed in und librariesAtom leer ist', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    mockUseStorage.mockReturnValue({
      isLoading: false,
      error: null,
      refreshAuthStatus: vi.fn(),
    })
    const store = createStore()
    store.set(librariesAtom, [])

    render(
      <Provider store={store}>
        <LibraryPage />
      </Provider>
    )

    expect(screen.getByText(/Keine Bibliotheken vorhanden/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Erste Bibliothek erstellen/i })).toBeTruthy()
  })

  it('rendert die Library-Komponente, wenn signed in und Library vorhanden ist', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    mockUseStorage.mockReturnValue({
      isLoading: false,
      error: null,
      refreshAuthStatus: vi.fn(),
    })
    const store = createStore()
    store.set(librariesAtom, [makeLibrary()])

    render(
      <Provider store={store}>
        <LibraryPage />
      </Provider>
    )

    expect(screen.getByTestId('library-component')).toBeTruthy()
  })
})
