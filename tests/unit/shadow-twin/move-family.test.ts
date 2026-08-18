/**
 * @fileoverview Unit-Tests: Familien-Umzug (Welle 0e)
 *
 * Die REIHENFOLGE ist der Vertrag: Import (nichts verlieren) → Siblings →
 * Quelle → Mongo → alter Spiegel weg → Export (Spiegel neu). Eine Quelle ohne
 * Twins wird einfach bewegt, ohne Engine-Laeufe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { moveFamily } from '@/lib/shadow-twin/move-family'
import type { Library } from '@/types/library'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const calls: string[] = []

const engineMocks = vi.hoisted(() => ({ runLibrarySync: vi.fn() }))
vi.mock('@/lib/shadow-twin/sync-engine/run-library-sync', () => engineMocks)

const repoMocks = vi.hoisted(() => ({ getShadowTwinsBySourceIds: vi.fn() }))
vi.mock('@/lib/repositories/shadow-twin-repo', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getShadowTwinsBySourceIds: repoMocks.getShadowTwinsBySourceIds,
}))

const locationMocks = vi.hoisted(() => ({ updateShadowTwinSourceLocation: vi.fn() }))
vi.mock('@/lib/repositories/shadow-twin-location', () => locationMocks)

const folderMocks = vi.hoisted(() => ({ findShadowTwinFolder: vi.fn() }))
vi.mock('@/lib/storage/shadow-twin', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findShadowTwinFolder: folderMocks.findShadowTwinFolder,
}))

const item = (id: string, name: string, type: 'file' | 'folder' = 'file', parentId = 'alt'): StorageItem =>
  ({ id, type, parentId, metadata: { name } }) as unknown as StorageItem

function makeProvider(siblings: StorageItem[]): StorageProvider {
  return {
    getItemById: vi.fn(async () => item('src-1', 'Besprechung.m4a')),
    listItemsById: vi.fn(async () => siblings),
    renameItem: vi.fn(async (id: string, n: string) => { calls.push(`rename:${id}:${n}`); return item(id, n) }),
    moveItem: vi.fn(async (id: string, p: string) => { calls.push(`move:${id}:${p}`) }),
    deleteItem: vi.fn(async (id: string) => { calls.push(`delete:${id}`) }),
  } as unknown as StorageProvider
}

const BASE = {
  library: {} as Library, libraryId: 'lib-1', userEmail: 'u@example.org', sourceId: 'src-1',
}

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  engineMocks.runLibrarySync.mockImplementation(async (args: { preset: string }) => {
    calls.push(`sync:${args.preset}`)
    return {}
  })
  locationMocks.updateShadowTwinSourceLocation.mockImplementation(async () => { calls.push('mongo-update') })
})

describe('moveFamily — mit Twin-Familie', () => {
  it('haelt die Reihenfolge: import → siblings → quelle → mongo → spiegel weg → export', async () => {
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValue(new Map([['src-1', {}]]))
    folderMocks.findShadowTwinFolder.mockResolvedValue(item('twin-1', '_Besprechung.m4a', 'folder'))
    const provider = makeProvider([item('sib-1', 'Besprechung.de.md')])

    const result = await moveFamily({ ...BASE, provider, newName: 'Team-Besprechung.m4a', newParentId: 'neu' })

    expect(calls).toEqual([
      'sync:import',
      'rename:sib-1:Team-Besprechung.de.md',
      'move:sib-1:neu',
      'rename:src-1:Team-Besprechung.m4a',
      'move:src-1:neu',
      'mongo-update',
      'delete:twin-1',
      'sync:export',
    ])
    expect(result).toMatchObject({
      imported: true, renamedSource: true, movedSource: true,
      mongoUpdated: true, oldTwinFolderDeleted: true, exported: true,
      renamedSiblings: ['Team-Besprechung.de.md'],
    })
    expect(locationMocks.updateShadowTwinSourceLocation).toHaveBeenCalledWith({
      libraryId: 'lib-1', sourceId: 'src-1', sourceName: 'Team-Besprechung.m4a', parentId: 'neu',
    })
  })
})

describe('moveFamily — ohne Twins (gewoehnliche Datei)', () => {
  it('bewegt nur die Quelle, keine Engine-Laeufe, kein Mongo-Update', async () => {
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValue(new Map())
    folderMocks.findShadowTwinFolder.mockResolvedValue(null)
    const provider = makeProvider([])

    const result = await moveFamily({ ...BASE, provider, newParentId: 'neu' })

    expect(calls).toEqual(['move:src-1:neu'])
    expect(result).toMatchObject({ imported: false, mongoUpdated: false, exported: false })
  })
})

describe('moveFamily — Wachen', () => {
  it('wirft ohne Ziel und bei identischem Ziel', async () => {
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValue(new Map())
    folderMocks.findShadowTwinFolder.mockResolvedValue(null)
    const provider = makeProvider([])
    await expect(moveFamily({ ...BASE, provider })).rejects.toThrow(/Pflicht/)
    await expect(moveFamily({ ...BASE, provider, newName: 'Besprechung.m4a', newParentId: 'alt' }))
      .rejects.toThrow(/identisch/)
  })

  it('wirft fuer Ordner', async () => {
    const provider = makeProvider([])
    ;(provider.getItemById as ReturnType<typeof vi.fn>).mockResolvedValue(item('dir-1', 'Ordner', 'folder'))
    await expect(moveFamily({ ...BASE, provider, sourceId: 'dir-1', newParentId: 'neu' }))
      .rejects.toThrow(/nur fuer Dateien/)
  })
})
