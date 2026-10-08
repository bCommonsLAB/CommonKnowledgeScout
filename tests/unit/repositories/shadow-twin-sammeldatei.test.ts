/**
 * Welle E — compositeSources am Twin: Upsert mit Identitaet und updatedAt,
 * Dubletten entfernt, Rueckwaertsabfrage ueber das indizierte Feld.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ updateOne: vi.fn(), find: vi.fn(), ensure: vi.fn() }))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinCollection: async () => ({ updateOne: h.updateOne, find: h.find }),
  ensureShadowTwinIndexes: h.ensure,
}))

import { findeSammeldateienMitQuelle, setzeSammeldateiQuellen } from '@/lib/repositories/shadow-twin-sammeldatei'

beforeEach(() => {
  h.updateOne.mockReset().mockResolvedValue({ matchedCount: 1 })
  h.find.mockReset().mockReturnValue({ sort: () => ({ toArray: async () => [{ sourceId: 'c1' }] }) })
})

describe('setzeSammeldateiQuellen', () => {
  it('upsertet Identitaet, updatedAt und die Quellen ohne Dubletten', async () => {
    await setzeSammeldateiQuellen({ libraryId: 'lib', userEmail: 'o@x', sourceId: 'c1', sourceName: 'S.md', parentId: 'p', quellenIds: ['a', 'b', 'a'] })
    const [filter, update, opts] = h.updateOne.mock.calls[0]
    expect(filter).toEqual({ libraryId: 'lib', sourceId: 'c1' })
    expect(update.$set).toMatchObject({ libraryId: 'lib', sourceId: 'c1', sourceName: 'S.md', parentId: 'p', compositeSources: ['a', 'b'] })
    expect(typeof update.$set.updatedAt).toBe('string')
    expect(update.$setOnInsert).toMatchObject({ artifacts: {} })
    expect(opts).toEqual({ upsert: true })
    expect(h.ensure).toHaveBeenCalledWith('lib')
  })

  it('wirft ohne sourceId', async () => {
    await expect(setzeSammeldateiQuellen({ libraryId: 'lib', userEmail: 'o@x', sourceId: '', sourceName: 'S', parentId: 'p', quellenIds: [] })).rejects.toThrow(/sourceId fehlt/)
  })
})

describe('findeSammeldateienMitQuelle', () => {
  it('fragt ueber compositeSources ab', async () => {
    const docs = await findeSammeldateienMitQuelle('lib', 'q1')
    expect(h.find).toHaveBeenCalledWith({ libraryId: 'lib', compositeSources: 'q1' })
    expect(docs).toEqual([{ sourceId: 'c1' }])
  })
})
