/**
 * @fileoverview Familien-Umzug auf Providern mit pfadbasierten Ids (Nextcloud).
 *
 * Befund 23.09.2026: Umbenennen aendert die Storage-Id (base64 des Pfads).
 * moveFamily rechnete mit der alten Id weiter — Twin-Dokument behielt den
 * alten Schluessel, Export lief ins Leere, im Schaufenster blieb der alte
 * Eintrag und die naechste Transformation legte einen zweiten daneben.
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

const rekeyMocks = vi.hoisted(() => ({ rekeyVectorsFileId: vi.fn() }))
vi.mock('@/lib/repositories/vector-rekey', () => rekeyMocks)
vi.mock('@/lib/repositories/vector-repo', () => ({ getCollectionNameForLibrary: () => 'vectors__aeced' }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

/** Pfadbasierte Ids wie Nextcloud: base64 des Pfads. */
const pid = (path: string) => Buffer.from(path, 'utf-8').toString('base64')
const item = (path: string, type: 'file' | 'folder' = 'file'): StorageItem => {
  const parts = path.split('/')
  const name = parts.pop() ?? path
  return { id: pid(path), type, parentId: parts.length ? pid(parts.join('/')) : 'root', metadata: { name } } as unknown as StorageItem
}

/** Provider, der Pfade als Ids fuehrt und Umbenennen/Verschieben wie WebDAV-MOVE behandelt. */
function makeProvider(initial: StorageItem[]): StorageProvider {
  const items = new Map(initial.map((i) => [i.id, i]))
  const pathOf = (id: string) => Buffer.from(id, 'base64').toString('utf-8')
  return {
    getItemById: vi.fn(async (id: string) => {
      const found = items.get(id)
      if (found) return found
      return { id, type: 'folder', parentId: 'root', metadata: { name: pathOf(id).split('/').pop() } } as unknown as StorageItem
    }),
    listItemsById: vi.fn(async (parentId: string) => [...items.values()].filter((i) => i.parentId === parentId)),
    renameItem: vi.fn(async (id: string, newName: string) => {
      const old = items.get(id)!
      const parts = pathOf(id).split('/'); parts.pop()
      const neu = item([...parts, newName].join('/'), old.type)
      items.delete(id); items.set(neu.id, neu)
      calls.push(`rename:${pathOf(id)}→${newName}`)
      return neu
    }),
    moveItem: vi.fn(async (id: string, newParentId: string) => {
      const old = items.get(id)!
      const neu = item(`${pathOf(newParentId)}/${old.metadata.name}`, old.type)
      items.delete(id); items.set(neu.id, neu)
      calls.push(`move:${pathOf(id)}→${pathOf(newParentId)}`)
    }),
    deleteItem: vi.fn(async (id: string) => { calls.push(`delete:${pathOf(id)}`) }),
  } as unknown as StorageProvider
}

const LIB = { id: 'lib-1', config: { chat: { vectorStore: { collectionName: 'aeced' } } } } as unknown as Library
const ALT = 'methoden/commoning_kompass.md'
const BASE = { library: LIB, libraryId: 'lib-1', userEmail: 'u@example.org', sourceId: pid(ALT) }

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  engineMocks.runLibrarySync.mockImplementation(async (args: { preset: string; scope: { sourceIds: string[] } }) => {
    calls.push(`sync:${args.preset}:${args.scope.sourceIds.map((id) => Buffer.from(id, 'base64').toString('utf-8')).join(',')}`)
    return {}
  })
  locationMocks.updateShadowTwinSourceLocation.mockResolvedValue(undefined)
  rekeyMocks.rekeyVectorsFileId.mockResolvedValue({ umgeschrieben: 7 })
})

describe('moveFamily — pfadbasierte Ids (Nextcloud)', () => {
  it('Umbenennen: neue Id fuer Mongo, Schaufenster und Export; Antwort nennt sie', async () => {
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValue(new Map([[pid(ALT), {}]]))
    folderMocks.findShadowTwinFolder.mockResolvedValue(item('methoden/_commoning_kompass.md', 'folder'))
    const provider = makeProvider([item('methoden', 'folder'), item(ALT)])

    const result = await moveFamily({ ...BASE, provider, newName: 'methode-08-commoning-kompass.md' })

    const NEU = 'methoden/methode-08-commoning-kompass.md'
    expect(result).toMatchObject({
      renamedSource: true, mongoUpdated: true, exported: true,
      newSourceId: pid(NEU), sourceIdChanged: true, vectorsRekeyed: 7,
    })
    expect(locationMocks.updateShadowTwinSourceLocation).toHaveBeenCalledWith({
      libraryId: 'lib-1', sourceId: pid(ALT), newSourceId: pid(NEU),
      sourceName: 'methode-08-commoning-kompass.md', parentId: pid('methoden'),
    })
    expect(rekeyMocks.rekeyVectorsFileId).toHaveBeenCalledWith('vectors__aeced', pid(ALT), pid(NEU))
    // Export laeuft mit der NEUEN Id — mit der alten fand die Engine nichts.
    expect(calls.at(-1)).toBe(`sync:export:${NEU}`)
  })

  it('Umbenennen + Verschieben: Siblings und Quelle nutzen die jeweils aktuelle Id', async () => {
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValue(new Map([[pid(ALT), {}]]))
    folderMocks.findShadowTwinFolder.mockResolvedValue(null)
    const provider = makeProvider([
      item('methoden', 'folder'), item('archiv', 'folder'), item(ALT), item('methoden/commoning_kompass.de.md'),
    ])

    const result = await moveFamily({ ...BASE, provider, newName: 'kompass.md', newParentId: pid('archiv') })

    expect(calls).toEqual([
      'sync:import:' + ALT,
      'rename:methoden/commoning_kompass.de.md→kompass.de.md',
      'move:methoden/kompass.de.md→archiv',
      'rename:methoden/commoning_kompass.md→kompass.md',
      'move:methoden/kompass.md→archiv',
      'sync:export:archiv/kompass.md',
    ])
    expect(result.newSourceId).toBe(pid('archiv/kompass.md'))
    expect(result.sourceIdChanged).toBe(true)
  })

  it('Library ohne Vektor-Sammlung: Schaufenster wird ausdruecklich nicht angefasst (null)', async () => {
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValue(new Map())
    folderMocks.findShadowTwinFolder.mockResolvedValue(null)
    const provider = makeProvider([item('methoden', 'folder'), item(ALT)])

    const result = await moveFamily({ ...BASE, library: { id: 'lib-1' } as Library, provider, newName: 'x.md' })

    expect(result.vectorsRekeyed).toBeNull()
    expect(rekeyMocks.rekeyVectorsFileId).not.toHaveBeenCalled()
  })
})
