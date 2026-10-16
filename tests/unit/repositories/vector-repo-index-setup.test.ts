/**
 * @fileoverview Suchindex-Setup darf nicht am Lese-Cache haengen (Befund 16.10.2026).
 *
 * Eine neue Library, deren Galerie vor dem ersten Ingest gelesen wurde
 * (getCollectionOnly fuellt den Collection-Cache), bekam beim Ingest keinen
 * `vector_search_idx` — der Story-Modus fand dann nichts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Library } from '@/types/library'

const state = vi.hoisted(() => ({ searchIndexes: [] as Array<{ name: string }> }))

const col = vi.hoisted(() => ({
  collectionName: 'doc_meta__lib-neu',
  createIndex: vi.fn(async () => 'ok'),
  listSearchIndexes: vi.fn(() => ({ toArray: async () => state.searchIndexes })),
  db: {
    databaseName: 'test',
    command: vi.fn(async (cmd: { createSearchIndexes?: string; indexes?: Array<{ name: string }> }) => {
      if (cmd.createSearchIndexes) state.searchIndexes.push({ name: cmd.indexes?.[0]?.name ?? '' })
      return { ok: 1 }
    }),
  },
}))

vi.mock('@/lib/mongodb-service', () => ({ getCollection: vi.fn(async () => col) }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { getCollectionOnly, getVectorCollection, VECTOR_SEARCH_INDEX_NAME } from '@/lib/repositories/vector-repo'

const library = { id: 'lib-neu', label: 'Neu', type: 'nextcloud', path: '/', isEnabled: true, config: {} } as unknown as Library

describe('getVectorCollection: Index-Setup trotz vorherigem Lesezugriff', () => {
  beforeEach(() => {
    state.searchIndexes = []
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('legt den Suchindex an, auch wenn getCollectionOnly die Collection schon geholt hat', async () => {
    await getCollectionOnly('doc_meta__lib-neu') // Lesepfad (Galerie) zuerst

    // ensureVectorSearchIndex wartet nach dem Anlegen 3 s auf Atlas (echte Uhr)
    await getVectorCollection('doc_meta__lib-neu', 2048, library)

    const creates = col.db.command.mock.calls.filter(([c]) => 'createSearchIndexes' in (c as object))
    expect(creates).toHaveLength(1)
    expect(state.searchIndexes.map((i) => i.name)).toEqual([VECTOR_SEARCH_INDEX_NAME])
  }, 10_000)

  it('fuehrt das Setup je Prozess nur einmal aus', async () => {
    const callsVorher = col.db.command.mock.calls.length
    await getVectorCollection('doc_meta__lib-neu', 2048, library)
    expect(col.db.command.mock.calls.length).toBe(callsVorher)
    expect(col.createIndex).not.toHaveBeenCalled()
  })
})
