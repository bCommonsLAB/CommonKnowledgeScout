// @vitest-environment jsdom

/**
 * Characterization Tests fuer `FileTree` (Welle 3-I, Schritt 3).
 *
 * Fixiert das Render-Verhalten:
 *
 * - Zeigt Ordner aus `loadedChildren['root']` als TreeItems an.
 * - Filtert Shadow-Twin-Ordner (Praefix `_`) im Filesystem-Modus.
 * - Rendert nichts kritisches, wenn `expandedFolders` leer ist.
 *
 * Storage-Provider wird via `useStorage`-Mock geliefert. Keine echten
 * API-Calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import {
  activeLibraryIdAtom,
  currentFolderIdAtom,
  expandedFoldersAtom,
  fileTreeReadyAtom,
  librariesAtom,
  folderItemsAtom,
} from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'
import type { StorageItem } from '@/lib/storage/types'

const mockUseStorage = vi.fn()

vi.mock('@/contexts/storage-context', async (orig) => {
  const actual = await orig<typeof import('@/contexts/storage-context')>()
  return {
    ...actual,
    useStorage: () => mockUseStorage(),
  }
})

vi.mock('@/hooks/use-folder-navigation', () => ({
  useFolderNavigation: () => vi.fn().mockResolvedValue(undefined),
}))

import { FileTree } from '@/components/library/file-tree'

function makeFolder(id: string, name: string, parentId = ''): StorageItem {
  return {
    id,
    parentId,
    type: 'folder',
    metadata: {
      name,
      size: 0,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'application/folder',
    },
  }
}

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

describe('FileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseStorage.mockReturnValue({
      provider: { id: 'lib-1', name: 'Test', listItemsById: vi.fn() },
      listItems: vi.fn().mockResolvedValue([]),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert Root-Ordner, sobald folderItemsAtom Root-Items enthaelt', async () => {
    const store = createStore()
    store.set(librariesAtom, [makeLibrary()])
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(currentFolderIdAtom, 'root')
    // folderItemsAtom liefert die Root-Items, der FileTree-Effekt
    // (Zeile 347 in file-tree.tsx) uebernimmt sie nach Mount in
    // loadedChildren.root.
    store.set(folderItemsAtom, [
      makeFolder('folder-1', 'Projekte'),
      makeFolder('folder-2', 'Bilder'),
    ])
    store.set(expandedFoldersAtom, new Set(['root']))

    render(
      <Provider store={store}>
        <FileTree />
      </Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('Projekte')).toBeTruthy()
    })
    expect(screen.getByText('Bilder')).toBeTruthy()
  })

  it('filtert Shadow-Twin-Ordner (Praefix `_`) im Filesystem-Modus', async () => {
    const store = createStore()
    const lib = makeLibrary({
      id: 'lib-1',
      config: {
        shadowTwin: { primaryStore: 'filesystem', persistToFilesystem: true },
      } as ClientLibrary['config'],
    })
    store.set(librariesAtom, [lib])
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(currentFolderIdAtom, 'root')
    store.set(folderItemsAtom, [
      makeFolder('folder-1', 'Sichtbar'),
      makeFolder('folder-twin', '_Shadow-Twin'),
    ])
    store.set(expandedFoldersAtom, new Set(['root']))

    render(
      <Provider store={store}>
        <FileTree />
      </Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('Sichtbar')).toBeTruthy()
    })
    expect(screen.queryByText('_Shadow-Twin')).toBeNull()
  })

  it('zeigt Shadow-Twin-Ordner, wenn persistToFilesystem=false', async () => {
    const store = createStore()
    // Mongo-Modus: `_`-Ordner sind regulaere User-Ordner.
    const lib = makeLibrary({
      id: 'lib-1',
      config: {
        shadowTwin: { primaryStore: 'mongo', persistToFilesystem: false },
      } as ClientLibrary['config'],
    })
    store.set(librariesAtom, [lib])
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(currentFolderIdAtom, 'root')
    store.set(folderItemsAtom, [makeFolder('folder-twin', '_Mein Ordner')])
    store.set(expandedFoldersAtom, new Set(['root']))

    render(
      <Provider store={store}>
        <FileTree />
      </Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('_Mein Ordner')).toBeTruthy()
    })
  })

  it('rendert ohne Crash, wenn folderItems leer sind', () => {
    const store = createStore()
    store.set(librariesAtom, [makeLibrary()])
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(currentFolderIdAtom, 'root')
    store.set(folderItemsAtom, [])
    store.set(expandedFoldersAtom, new Set(['root']))
    store.set(fileTreeReadyAtom, false)

    expect(() => {
      render(
        <Provider store={store}>
          <FileTree />
        </Provider>
      )
    }).not.toThrow()
  })
})
