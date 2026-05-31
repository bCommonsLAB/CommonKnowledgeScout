import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unit-Tests fuer `doc-relations-repo.ts` (Quelle A, Welle 4).
 *
 * MongoDB wird gemockt (`getCollection`); geprueft werden Collection-Naming,
 * die Replace-Semantik (deleteMany + insertMany) und das Scoping von
 * `getDocRelations` auf eine sichtbare Knotenmenge.
 */

interface MockCollection {
  createIndex: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  deleteMany: ReturnType<typeof vi.fn>
  insertMany: ReturnType<typeof vi.fn>
}

function buildMockCollection(): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 1 }),
  }
}

function buildFindResult<T>(docs: T[]) {
  return {
    toArray: vi.fn().mockResolvedValue(docs),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    next: vi.fn().mockResolvedValue(docs[0] ?? null),
  }
}

describe('doc-relations-repo', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('getDocRelationsCollectionName folgt dem Per-Library-Muster', async () => {
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn() }))
    const repo = await import('@/lib/repositories/doc-relations-repo')
    expect(repo.getDocRelationsCollectionName('lib-1')).toBe('doc_relations__lib-1')
  })

  it('getDocRelations scoped auf gefilterte fileIds (beide Endpunkte im Set)', async () => {
    const col = buildMockCollection()
    col.find = vi.fn().mockReturnValue(buildFindResult([]))
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))

    const repo = await import('@/lib/repositories/doc-relations-repo')
    await repo.getDocRelations('lib-1', ['a', 'b'])

    const query = col.find.mock.calls[0][0]
    expect(query.libraryId).toBe('lib-1')
    expect(query.sourceFileId).toEqual({ $in: ['a', 'b'] })
    expect(query.targetFileId).toEqual({ $in: ['a', 'b'] })
  })

  it('getDocRelations ohne fileIds lädt die ganze Library', async () => {
    const col = buildMockCollection()
    col.find = vi.fn().mockReturnValue(buildFindResult([]))
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))

    const repo = await import('@/lib/repositories/doc-relations-repo')
    await repo.getDocRelations('lib-1')

    const query = col.find.mock.calls[0][0]
    expect(query.sourceFileId).toBeUndefined()
    expect(query.targetFileId).toBeUndefined()
  })

  it('replaceEdgesForSource löscht nur die Quelle und fügt neu ein', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))

    const repo = await import('@/lib/repositories/doc-relations-repo')
    const edge = {
      libraryId: 'lib-1', sourceFileId: 'a', targetFileId: 'b',
      weight: 0.8, relationType: 'unterstuetzt', computedAt: new Date(), computedBy: 'gpt',
    }
    const res = await repo.replaceEdgesForSource('lib-1', 'a', [edge])

    expect(col.deleteMany).toHaveBeenCalledWith({ libraryId: 'lib-1', sourceFileId: 'a' })
    expect(col.insertMany).toHaveBeenCalledWith([edge])
    expect(res).toEqual({ deleted: 2, inserted: 1 })
  })

  it('replaceEdgesForSource ohne Kanten fügt nichts ein (nur Löschen)', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))

    const repo = await import('@/lib/repositories/doc-relations-repo')
    const res = await repo.replaceEdgesForSource('lib-1', 'a', [])

    expect(col.deleteMany).toHaveBeenCalledTimes(1)
    expect(col.insertMany).not.toHaveBeenCalled()
    expect(res.inserted).toBe(0)
  })

  it('replaceAllEdgesForLibrary löscht die ganze Library und fügt neu ein', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))

    const repo = await import('@/lib/repositories/doc-relations-repo')
    const edge = {
      libraryId: 'lib-1', sourceFileId: 'a', targetFileId: 'b',
      weight: 0.5, relationType: 'unterstuetzt', computedAt: new Date(), computedBy: 'gpt',
    }
    await repo.replaceAllEdgesForLibrary('lib-1', [edge])

    expect(col.deleteMany).toHaveBeenCalledWith({ libraryId: 'lib-1' })
    expect(col.insertMany).toHaveBeenCalledWith([edge])
  })
})
