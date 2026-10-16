import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/mongodb-service', () => ({ getCollection: vi.fn() }))

import { collectSnapshot, type StorageSnapshot } from '@/lib/storage-remap/snapshot'
import { planRemap } from '@/lib/storage-remap/plan'
import { remapTwinFelder } from '@/lib/storage-remap/remap-twins'
import { verweisUpdate } from '@/lib/storage-remap/remap-index'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'

const b64 = (p: string): string => Buffer.from(p, 'utf-8').toString('base64')

function snap(storageType: string, rootParentIds: string[], entries: StorageSnapshot['entries']): StorageSnapshot {
  return { libraryId: 'lib', createdAt: '2026-10-16T00:00:00Z', storageType, rootParentIds, entries }
}

// OneDrive: opake Ids, Wurzel meldet sich mit der Basisordner-Id.
const alt = snap('onedrive', ['root', 'BASE'], [
  { id: 'OD-A', parentId: 'BASE', relPath: 'Gespräche', type: 'folder' },
  { id: 'OD-B', parentId: 'OD-A', relPath: 'Gespräche/talk.mp3', type: 'file' },
  { id: 'OD-C', parentId: 'BASE', relPath: 'weg.pdf', type: 'file' },
])
// Nextcloud: Pfad-Ids; Umlaut absichtlich in NFD gemeldet.
const neu = snap('nextcloud', ['root'], [
  { id: b64('Gespräche'), parentId: 'root', relPath: 'Gespräche', type: 'folder' },
  { id: b64('Gespräche/talk.mp3'), parentId: b64('Gespräche'), relPath: 'Gespräche/talk.mp3', type: 'file' },
  { id: b64('neu.md'), parentId: 'root', relPath: 'neu.md', type: 'file' },
])

describe('planRemap', () => {
  it('ordnet ueber den NFC-Pfad zu und bildet die Wurzel ab', () => {
    const plan = planRemap(alt, neu)
    expect(plan.idMap.get('OD-A')).toBe(b64('Gespräche'))
    expect(plan.idMap.get('OD-B')).toBe(b64('Gespräche/talk.mp3'))
    expect(plan.idMap.get('BASE')).toBe('root')
    expect(plan.idMap.has('root')).toBe(false)
    expect(plan.ohnePartner.map((e) => e.relPath)).toEqual(['weg.pdf'])
    expect(plan.nurNeu).toBe(1)
    expect(plan.anteilGleicheIds).toBe(0)
  })

  it('meldet Typwechsel statt zuzuordnen', () => {
    const n = snap('nextcloud', ['root'], [{ id: 'x', parentId: 'root', relPath: 'Gespräche', type: 'file' }])
    const plan = planRemap(snap('onedrive', ['root'], [alt.entries[0]]), n)
    expect(plan.idMap.size).toBe(0)
    expect(plan.ohnePartner[0].grund).toContain('Typ')
  })

  it('erkennt unveraenderte Ids (noch nicht umgehaengt)', () => {
    expect(planRemap(alt, alt).anteilGleicheIds).toBe(1)
  })

  it('wirft bei verschiedenen Libraries und doppelten Pfaden', () => {
    expect(() => planRemap(alt, { ...neu, libraryId: 'anders' })).toThrow(/verschiedenen Libraries/)
    const doppelt = snap('nextcloud', ['root'], [neu.entries[0], { ...neu.entries[0], id: 'y', relPath: 'Gespräche' }])
    expect(() => planRemap(alt, doppelt)).toThrow(/doppelt/)
  })
})

describe('remapTwinFelder', () => {
  const plan = planRemap(alt, neu)
  it('schreibt sourceId, parentId, compositeSources und Fragment-fileIds um', () => {
    const res = remapTwinFelder({
      sourceId: 'OD-B', parentId: 'OD-A', compositeSources: ['OD-B', 'fremd'],
      binaryFragments: [{ name: 'a.jpg', fileId: 'OD-B' }, { name: 'b.jpg', url: 'https://blob' }],
    }, plan.idMap)
    expect(res).toEqual({
      sourceId: b64('Gespräche/talk.mp3'), parentId: b64('Gespräche'), compositeSources: [b64('Gespräche/talk.mp3'), 'fremd'],
      binaryFragments: [{ name: 'a.jpg', fileId: b64('Gespräche/talk.mp3') }, { name: 'b.jpg', url: 'https://blob' }],
    })
  })
  it('liefert null, wenn die Quelle keinen Partner hat', () => {
    expect(remapTwinFelder({ sourceId: 'OD-C', parentId: 'BASE' }, plan.idMap)).toBeNull()
  })
})

describe('verweisUpdate', () => {
  const plan = planRemap(alt, neu)
  it('zieht parentId, sourceFileId und Nachbarn nach', () => {
    const set = verweisUpdate({
      _id: 'x', parentId: 'OD-A',
      docMetaJson: { sourceFileId: 'OD-B', similarity_neighbors: [{ fileId: 'OD-B', score: 0.9 }, { fileId: 'fremd' }] },
    }, plan.idMap)
    expect(set).toEqual({
      parentId: b64('Gespräche'),
      'docMetaJson.sourceFileId': b64('Gespräche/talk.mp3'),
      'docMetaJson.similarity_neighbors': [{ fileId: b64('Gespräche/talk.mp3'), score: 0.9 }, { fileId: 'fremd' }],
    })
  })
  it('liefert null ohne Treffer', () => {
    expect(verweisUpdate({ _id: 'x', parentId: 'fremd' }, plan.idMap)).toBeNull()
  })
})

describe('collectSnapshot', () => {
  it('liest rekursiv und merkt sich die Wurzel-Id', async () => {
    const item = (id: string, parentId: string, name: string, type: 'file' | 'folder'): StorageItem =>
      ({ id, parentId, type, metadata: { name } } as unknown as StorageItem)
    const listing: Record<string, StorageItem[]> = {
      root: [item('A', 'BASE', 'Ordner', 'folder'), item('B', 'BASE', 'x.md', 'file')],
      A: [item('C', 'A', 'y.mp3', 'file')],
    }
    const provider = { listItemsById: async (id: string) => listing[id] ?? [] } as unknown as StorageProvider
    const s = await collectSnapshot({ provider, libraryId: 'lib', storageType: 'onedrive' })
    expect(s.rootParentIds.sort()).toEqual(['BASE', 'root'])
    expect(s.entries.map((e) => e.relPath)).toEqual(['Ordner', 'x.md', 'Ordner/y.mp3'])
  })
})
