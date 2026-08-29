/**
 * @fileoverview Riegel fuer den nebenlaeufigen Storage-Walk der Sync-Engine.
 *
 * Befund 29.08.2026 (Prod): Der Coverage-Scan kam nicht mehr durch. Nicht die
 * Dateimenge war schuld, sondern dieser Walk — er listete 1.129 Ordner EINZELN
 * nacheinander (~0,22 s je Listing auf OneDrive, also rund vier Minuten).
 *
 * Der Umbau darf genau eines NICHT: die Reihenfolge aendern. Aus dem Walk
 * faellt die Quellen-Liste, und an ihr haengen Plan und Report. Der erste Test
 * ist deshalb der wichtigste — er faehrt denselben Baum mit absichtlich
 * verdrehten Antwortzeiten und verlangt exakt die Reihenfolge der
 * Breitensuche.
 */

import { describe, it, expect, vi } from 'vitest'
import { resolveSources } from '@/lib/shadow-twin/sync-engine/resolve-sources'
import { FolderCache } from '@/lib/shadow-twin/sync-engine/folder-cache'
import { listFoldersParallel } from '@/lib/shadow-twin/sync-engine/list-folders-parallel'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const repoMocks = vi.hoisted(() => ({
  getShadowTwinsBySourceIds: vi.fn(async () => new Map<string, ShadowTwinDocument>()),
  getAllShadowTwins: vi.fn(async () => [] as ShadowTwinDocument[]),
}))
vi.mock('@/lib/repositories/shadow-twin-repo', () => repoMocks)

function file(id: string, name: string, parentId: string): StorageItem {
  return { id, type: 'file', parentId, metadata: { name } } as unknown as StorageItem
}
function folder(id: string, name: string, parentId: string): StorageItem {
  return { id, type: 'folder', parentId, metadata: { name } } as unknown as StorageItem
}
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Baum ueber drei Ebenen. Die Verzoegerungen sind absichtlich verdreht: der
 * ERSTE Ordner jeder Ebene antwortet am langsamsten. Eine Umsetzung, die
 * Ergebnisse in Eintreff-Reihenfolge verarbeitet, dreht die Liste damit um und
 * faellt hier durch.
 */
const BAUM: Record<string, StorageItem[]> = {
  root: [file('f-root', 'root.pdf', 'root'), folder('a', 'A', 'root'), folder('b', 'B', 'root')],
  a: [file('f-a1', 'a1.pdf', 'a'), folder('a1', 'A1', 'a')],
  b: [file('f-b1', 'b1.pdf', 'b')],
  a1: [file('f-a1x', 'a1x.pdf', 'a1')],
}
const VERZOEGERUNG: Record<string, number> = { root: 0, a: 30, b: 1, a1: 0 }

function makeProvider(): { provider: StorageProvider; gleichzeitigMax: () => number } {
  let gleichzeitig = 0
  let max = 0
  const provider = {
    listItemsById: vi.fn(async (id: string) => {
      gleichzeitig += 1
      max = Math.max(max, gleichzeitig)
      try {
        await warte(VERZOEGERUNG[id] ?? 0)
        return BAUM[id] ?? []
      } finally {
        gleichzeitig -= 1
      }
    }),
    getItemById: vi.fn(async (id: string) => {
      const item = Object.values(BAUM).flat().find((it) => it.id === id)
      if (!item) throw new Error(`Item nicht gefunden: ${id}`)
      return item
    }),
  } as unknown as StorageProvider
  return { provider, gleichzeitigMax: () => max }
}

describe('resolveSources — nebenlaeufiger Walk', () => {
  it('liefert exakt die Breitensuche-Reihenfolge, auch wenn der erste Ordner am langsamsten ist', async () => {
    const { provider } = makeProvider()
    const { pairs } = await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'root' }, folderCache: new FolderCache(provider), provider,
    })
    // Ebene 0: root. Ebene 1: a, b (in Listing-Reihenfolge). Ebene 2: a1.
    expect(pairs.map((p) => p.sourceItem?.id)).toEqual(['f-root', 'f-a1', 'f-b1', 'f-a1x'])
  })

  it('listet die Ordner einer Ebene wirklich gleichzeitig', async () => {
    const { provider, gleichzeitigMax } = makeProvider()
    await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'root' }, folderCache: new FolderCache(provider), provider,
    })
    // Ebene 1 hat zwei Ordner (a, b) — seriell waere das Maximum 1.
    expect(gleichzeitigMax()).toBeGreaterThan(1)
  })

  it('traegt die relative Pfadlaenge weiterhin je Ordner korrekt mit', async () => {
    const { provider } = makeProvider()
    const { pairs } = await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'root' }, folderCache: new FolderCache(provider), provider,
    })
    const nachId = new Map(pairs.map((p) => [p.sourceItem?.id, p.parentPathLength]))
    expect(nachId.get('f-root')).toBe(0)
    expect(nachId.get('f-a1')).toBe('A'.length + 1)
    expect(nachId.get('f-a1x')).toBe('A'.length + 1 + 'A1'.length + 1)
  })
})

describe('listFoldersParallel', () => {
  it('ordnet Ergebnisse nach EINGABE, nicht nach Antwortzeit', async () => {
    const verzoegerung: Record<string, number> = { x: 20, y: 10, z: 0 }
    const ergebnis = await listFoldersParallel({
      folderIds: ['x', 'y', 'z'],
      list: async (id) => {
        await warte(verzoegerung[id])
        return [file(`f-${id}`, `${id}.pdf`, id)]
      },
    })
    expect(ergebnis.map((items) => items[0].id)).toEqual(['f-x', 'f-y', 'f-z'])
  })

  it('haelt die Nebenlaeufigkeitsgrenze ein', async () => {
    let gleichzeitig = 0
    let max = 0
    await listFoldersParallel({
      folderIds: ['1', '2', '3', '4', '5', '6'],
      concurrency: 2,
      list: async () => {
        gleichzeitig += 1
        max = Math.max(max, gleichzeitig)
        await warte(5)
        gleichzeitig -= 1
        return []
      },
    })
    expect(max).toBe(2)
  })

  it('verschluckt einen Lesefehler nicht', async () => {
    await expect(
      listFoldersParallel({
        folderIds: ['ok', 'kaputt'],
        concurrency: 1,
        list: async (id) => {
          if (id === 'kaputt') throw new Error('Ordner nicht lesbar')
          return []
        },
      }),
    ).rejects.toThrow('Ordner nicht lesbar')
  })

  it('kommt mit einer leeren Liste zurecht', async () => {
    const list = vi.fn()
    expect(await listFoldersParallel({ folderIds: [], list })).toEqual([])
    expect(list).not.toHaveBeenCalled()
  })
})

describe('FolderCache unter Nebenlaeufigkeit', () => {
  it('fragt denselben Ordner bei gleichzeitigen Aufrufen nur EINMAL beim Storage an', async () => {
    const listItemsById = vi.fn(async () => {
      await warte(10)
      return [file('f-1', 'a.pdf', 'top')]
    })
    const cache = new FolderCache({ listItemsById } as unknown as StorageProvider)
    const [a, b] = await Promise.all([cache.list('top'), cache.list('top')])
    expect(listItemsById).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('merkt sich einen Fehlschlag NICHT — der naechste Aufruf fragt neu', async () => {
    let versuch = 0
    const listItemsById = vi.fn(async () => {
      versuch += 1
      if (versuch === 1) throw new Error('429')
      return [file('f-1', 'a.pdf', 'top')]
    })
    const cache = new FolderCache({ listItemsById } as unknown as StorageProvider)
    await expect(cache.list('top')).rejects.toThrow('429')
    expect((await cache.list('top'))[0].id).toBe('f-1')
  })
})
