// @vitest-environment jsdom

/**
 * Characterization Tests fuer die `Library`-Schale (Welle 3-I, Schritt 3).
 *
 * Fixiert die **Status-Branches** der Schale (siehe Contract §4):
 *
 * - `libraryStatus === 'waitingForAuth'` → Auth-Hinweis sichtbar.
 * - `libraryStatus !== 'ready'` (z.B. 'providerLoading') → Lade-Hinweis.
 * - `libraryStatus === 'ready'` → echte Render-Pipeline (Header,
 *   FileList, FilePreview etc.) wird aktiviert.
 *
 * Wir mocken alle Sub-Komponenten und den `useStorage`-Hook, damit
 * der Test nur die Status-Logik der Schale prueft.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'

const mockUseStorage = vi.fn()

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
  usePathname: () => '/library',
}))

vi.mock('@/components/library/library-header', () => ({
  LibraryHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="library-header">{children}</div>
  ),
}))

vi.mock('@/components/library/file-tree', () => ({
  FileTree: () => <div data-testid="file-tree" />,
}))

vi.mock('@/components/library/file-list', () => ({
  FileList: () => <div data-testid="file-list" />,
}))

vi.mock('@/components/library/breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}))

// Use-toast braucht keinen echten Toast; eine leere Funktion reicht.
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/hooks/use-folder-navigation', () => ({
  useFolderNavigation: () => vi.fn().mockResolvedValue(undefined),
}))

// next/dynamic-Loader liefert ein einfaches Stub-Component.
vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="file-preview-lazy" />,
}))

import { Library } from '@/components/library/library'

function makeLibrary(overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id: 'lib-1',
    label: 'Test Library',
    type: 'local',
    path: '/tmp',
    isEnabled: true,
    config: {},
    ...overrides,
  } as ClientLibrary
}

describe('Library (App-Schale)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom liefert kein `matchMedia` von Haus aus, die Library-Komponente
    // nutzt es aber fuer Mobile-Detection (Zeile 105 in library.tsx).
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt einen Auth-Hinweis, wenn libraryStatus="waitingForAuth"', () => {
    mockUseStorage.mockReturnValue({
      provider: null,
      error: null,
      listItems: vi.fn(),
      libraryStatus: 'waitingForAuth',
      currentLibrary: null,
    })
    const store = createStore()
    store.set(librariesAtom, [makeLibrary()])
    store.set(activeLibraryIdAtom, 'lib-1')

    render(
      <Provider store={store}>
        <Library />
      </Provider>
    )

    expect(screen.getByText(/Authentifizierung/i)).toBeTruthy()
  })

  it('zeigt einen Lade-Hinweis, wenn libraryStatus !== "ready"', () => {
    mockUseStorage.mockReturnValue({
      provider: null,
      error: null,
      listItems: vi.fn(),
      libraryStatus: 'providerLoading',
      currentLibrary: null,
    })
    const store = createStore()
    store.set(librariesAtom, [makeLibrary()])
    store.set(activeLibraryIdAtom, 'lib-1')

    render(
      <Provider store={store}>
        <Library />
      </Provider>
    )

    expect(screen.getByText(/Lade Storage/i)).toBeTruthy()
  })

  it('rendert Header und FileList, wenn libraryStatus="ready"', () => {
    const lib = makeLibrary({ id: 'lib-1' })
    mockUseStorage.mockReturnValue({
      provider: { id: 'lib-1', name: 'Test' },
      error: null,
      listItems: vi.fn().mockResolvedValue([]),
      libraryStatus: 'ready',
      currentLibrary: lib,
    })
    const store = createStore()
    store.set(librariesAtom, [lib])
    store.set(activeLibraryIdAtom, 'lib-1')

    render(
      <Provider store={store}>
        <Library />
      </Provider>
    )

    expect(screen.getByTestId('library-header')).toBeTruthy()
    expect(screen.getAllByTestId('file-list').length).toBeGreaterThan(0)
  })
})
