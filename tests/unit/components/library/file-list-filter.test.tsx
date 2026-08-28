/**
 * Characterization Tests fuer den **Filter-Vertrag** der Dateiliste
 * (Welle 3-I, Schritt 3).
 *
 * Statt der vollstaendigen `FileList`-Komponente (89 Hooks) testen wir die
 * kanonische Filter-/Sort-Regel der Liste. Sie lag bis zur Modularisierungs-
 * Welle M4e im abgeleiteten Atom `sortedFilteredFilesAtom` und steht seither
 * als reine Funktion in `@/lib/file-list/filter-sort` — der Hook
 * `useSortedFilteredFiles()` reicht ihr nur die Atom-Werte herein. Der Test
 * ist mitgewandert und definiert weiterhin das Soll-Verhalten.
 */

import { describe, it, expect } from 'vitest'
import { filterAndSortFiles, type FileListFilterInput } from '@/lib/file-list/filter-sort'
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

/**
 * Der Hook filtert Verzeichnisse bereits ueber `filesOnlyAtom` heraus, bevor er
 * die Regel aufruft — deshalb macht der Aufbau hier dasselbe.
 */
function run(items: StorageItem[], overrides: Partial<FileListFilterInput> = {}): StorageItem[] {
  return filterAndSortFiles({
    files: items.filter(item => item.type === 'file'),
    searchTerm: '',
    sortField: 'name',
    sortOrder: 'asc',
    categoryFilter: 'all',
    annotationFilter: 'all',
    annotations: new Map(),
    divaEnabled: false,
    ...overrides,
  })
}

describe('filterAndSortFiles (FileList Filter-Vertrag)', () => {
  it('filtert Verzeichnisse heraus (nur Files)', () => {
    const result = run([
      makeFile('f1', 'document.pdf'),
      makeFolder('d1', 'Some Folder'),
    ])

    expect(result.map(i => i.id)).toEqual(['f1'])
  })

  it('filtert Dateien, die mit Punkt beginnen (Dotfiles)', () => {
    const result = run([
      makeFile('f1', '.hidden.pdf'),
      makeFile('f2', 'visible.pdf'),
    ])

    expect(result.map(i => i.id)).toEqual(['f2'])
  })

  it('filtert nach Suchbegriff (case-insensitive Substring)', () => {
    const result = run([
      makeFile('f1', 'Bericht 2026.pdf'),
      makeFile('f2', 'Foto urlaub.jpg'),
      makeFile('f3', 'BERICHT alt.md'),
    ], { searchTerm: 'bericht' })

    expect(result.map(i => i.id).sort()).toEqual(['f1', 'f3'])
  })

  it('sortiert standardmaessig alphabetisch aufsteigend nach Name', () => {
    const result = run([
      makeFile('f1', 'zebra.pdf'),
      makeFile('f2', 'apfel.pdf'),
      makeFile('f3', 'mango.pdf'),
    ])

    expect(result.map(i => i.metadata.name)).toEqual(['apfel.pdf', 'mango.pdf', 'zebra.pdf'])
  })

  it('sortiert nach Groesse, wenn sortField=size + sortOrder=desc', () => {
    const result = run([
      makeFile('f1', 'klein.pdf', 100),
      makeFile('f2', 'gross.pdf', 5000),
      makeFile('f3', 'mittel.pdf', 1000),
    ], { sortField: 'size', sortOrder: 'desc' })

    expect(result.map(i => i.metadata.size)).toEqual([5000, 1000, 100])
  })

  it('respektiert fileCategoryFilter (z.B. "all" liefert alles)', () => {
    const result = run([
      makeFile('f1', 'doc.pdf'),
      makeFile('f2', 'doc.md'),
    ], { categoryFilter: 'all' })

    expect(result).toHaveLength(2)
  })

  describe('DIVA-Filter (*_basecolor + Sidecar-Treffer)', () => {
    const divaItems = [
      makeFile('f1', '3_ST_2031_0332_basecolor.jpg'),
      makeFile('f2', 'kein_muster_basecolor.jpg'),
      makeFile('f3', '3_ST_2031_0332_normal.jpg'),
      makeFile('f4', 'readme.txt'),
    ]
    // Nur f1 hat Sidecar-Treffer (keyed nach Dateiname).
    const annotations = new Map([['3_ST_2031_0332_basecolor.jpg', { stoffgruppe: 'Feincord' }]])

    function runDiva(annotationFilter: FileListFilterInput['annotationFilter']) {
      return run(divaItems, { divaEnabled: true, annotationFilter, annotations })
    }

    it('"all" liefert alle *_basecolor (keine anderen Maps)', () => {
      expect(runDiva('all').map(i => i.id).sort()).toEqual(['f1', 'f2'])
    })

    it('"with" liefert nur *_basecolor mit DIVA-Info', () => {
      expect(runDiva('with').map(i => i.id)).toEqual(['f1'])
    })

    it('"without" liefert nur *_basecolor ohne DIVA-Info', () => {
      expect(runDiva('without').map(i => i.id)).toEqual(['f2'])
    })
  })
})
