// @vitest-environment jsdom

/**
 * Characterization Tests fuer den **Filter-Vertrag** der Dateiliste
 * (Welle 3-I, Schritt 3).
 *
 * Statt der vollstaendigen `FileList`-Komponente (89 Hooks) testen wir
 * den abgeleiteten Atom `sortedFilteredFilesAtom`, der nach dem Modul-
 * Split zentraler Bestandteil von `hooks/use-file-list-filter.ts` werden
 * soll. Das ist die kanonische Filter-/Sort-Logik der Liste.
 *
 * Wenn Schritt 4b den Atom umbenennt oder verschiebt, muss dieser Test
 * mitgehen — er definiert das Soll-Verhalten.
 */

import { describe, it, expect } from 'vitest'
import { createStore } from 'jotai'
import {
  activeLibraryIdAtom,
  folderItemsAtom,
  searchTermAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
} from '@/atoms/library-atom'
import { fileCategoryFilterAtom } from '@/atoms/transcription-options'
import type { StorageItem } from '@/lib/storage/types'

function makeFile(id: string, name: string, size = 100, modifiedAt = new Date('2026-01-01')): StorageItem {
  return {
    id,
    parentId: 'root',
    type: 'file',
    metadata: {
      name,
      size,
      modifiedAt,
      mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
    },
  }
}

function makeFolder(id: string, name: string): StorageItem {
  return {
    id,
    parentId: 'root',
    type: 'folder',
    metadata: {
      name,
      size: 0,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'application/folder',
    },
  }
}

describe('sortedFilteredFilesAtom (FileList Filter-Vertrag)', () => {
  it('filtert Verzeichnisse heraus (nur Files)', () => {
    const store = createStore()
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(folderItemsAtom, [
      makeFile('f1', 'document.pdf'),
      makeFolder('d1', 'Some Folder'),
    ])

    const result = store.get(sortedFilteredFilesAtom)

    expect(result.map(i => i.id)).toEqual(['f1'])
  })

  it('filtert Dateien, die mit Punkt beginnen (Dotfiles)', () => {
    const store = createStore()
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(folderItemsAtom, [
      makeFile('f1', '.hidden.pdf'),
      makeFile('f2', 'visible.pdf'),
    ])

    const result = store.get(sortedFilteredFilesAtom)

    expect(result.map(i => i.id)).toEqual(['f2'])
  })

  it('filtert nach Suchbegriff (case-insensitive Substring)', () => {
    const store = createStore()
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(folderItemsAtom, [
      makeFile('f1', 'Bericht 2026.pdf'),
      makeFile('f2', 'Foto urlaub.jpg'),
      makeFile('f3', 'BERICHT alt.md'),
    ])
    store.set(searchTermAtom, 'bericht')

    const result = store.get(sortedFilteredFilesAtom)

    expect(result.map(i => i.id).sort()).toEqual(['f1', 'f3'])
  })

  it('sortiert standardmaessig alphabetisch aufsteigend nach Name', () => {
    const store = createStore()
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(folderItemsAtom, [
      makeFile('f1', 'zebra.pdf'),
      makeFile('f2', 'apfel.pdf'),
      makeFile('f3', 'mango.pdf'),
    ])

    const result = store.get(sortedFilteredFilesAtom)

    expect(result.map(i => i.metadata.name)).toEqual(['apfel.pdf', 'mango.pdf', 'zebra.pdf'])
  })

  it('sortiert nach Groesse, wenn sortField=size + sortOrder=desc', () => {
    const store = createStore()
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(folderItemsAtom, [
      makeFile('f1', 'klein.pdf', 100),
      makeFile('f2', 'gross.pdf', 5000),
      makeFile('f3', 'mittel.pdf', 1000),
    ])
    store.set(sortFieldAtom, 'size')
    store.set(sortOrderAtom, 'desc')

    const result = store.get(sortedFilteredFilesAtom)

    expect(result.map(i => i.metadata.size)).toEqual([5000, 1000, 100])
  })

  it('respektiert fileCategoryFilter (z.B. "all" liefert alles)', () => {
    const store = createStore()
    store.set(activeLibraryIdAtom, 'lib-1')
    store.set(folderItemsAtom, [
      makeFile('f1', 'doc.pdf'),
      makeFile('f2', 'doc.md'),
    ])
    store.set(fileCategoryFilterAtom, 'all')

    const result = store.get(sortedFilteredFilesAtom)

    expect(result).toHaveLength(2)
  })
})
