import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unit-Tests fuer `source-user-states-repo.ts`.
 *
 * Wir testen ohne echte MongoDB - `getCollection` wird gemockt und
 * Aufrufe geprueft.
 */

interface MockCollection {
  createIndex: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  findOne: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
  deleteOne: ReturnType<typeof vi.fn>
}

function buildMockCollection(): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, upsertedCount: 0 }),
    deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
  }
}

function buildFindResult<T>(docs: T[]) {
  return {
    project: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  }
}

describe('source-user-states-repo', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('getOwnStates partitioniert favorite und not_important', async () => {
    const col = buildMockCollection()
    col.find = vi.fn().mockReturnValue(
      buildFindResult([
        { fileId: 'f1', state: 'favorite' },
        { fileId: 'f2', state: 'not_important' },
        { fileId: 'f3', state: 'favorite' },
      ]),
    )

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.getOwnStates('lib-1', 'Anna@Example.com')

    expect(res.favorites.sort()).toEqual(['f1', 'f3'])
    expect(res.notImportant).toEqual(['f2'])
    // E-Mail wird normalisiert (lower-case) an Mongo gegeben
    expect(col.find).toHaveBeenCalledWith(
      { libraryId: 'lib-1', userEmail: 'anna@example.com' },
      expect.any(Object),
    )
  })

  it('setState mit Wert macht upsert', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.setState('lib-1', 'f1', 'anna@example.com', 'favorite')

    expect(res.state).toBe('favorite')
    expect(col.updateOne).toHaveBeenCalledTimes(1)
    const call = col.updateOne.mock.calls[0]
    expect(call[0]).toEqual({ libraryId: 'lib-1', fileId: 'f1', userEmail: 'anna@example.com' })
    expect(call[1].$set).toMatchObject({ state: 'favorite' })
    expect(call[1].$setOnInsert).toMatchObject({
      libraryId: 'lib-1',
      fileId: 'f1',
      userEmail: 'anna@example.com',
    })
    expect(call[2]).toEqual({ upsert: true })
  })

  it('setState mit null macht deleteOne', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.setState('lib-1', 'f1', 'anna@example.com', null)

    expect(res.state).toBeNull()
    expect(col.deleteOne).toHaveBeenCalledWith({
      libraryId: 'lib-1',
      fileId: 'f1',
      userEmail: 'anna@example.com',
    })
    expect(col.updateOne).not.toHaveBeenCalled()
  })

  it('getAggregatedFavorites zaehlt nur favorite und liefert sortierte Voter', async () => {
    const col = buildMockCollection()
    col.find = vi.fn().mockReturnValue(
      buildFindResult([
        { fileId: 'f1', userEmail: 'bernd@example.com' },
        { fileId: 'f1', userEmail: 'anna@example.com' },
        { fileId: 'f2', userEmail: 'carla@example.com' },
      ]),
    )
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.getAggregatedFavorites('lib-1', ['f1', 'f2', 'f3'])

    expect(res.counts).toEqual({ f1: 2, f2: 1 })
    expect(res.voters.f1).toEqual(['anna@example.com', 'bernd@example.com'])
    expect(res.voters.f2).toEqual(['carla@example.com'])
    expect(res.voters.f3).toBeUndefined()
    // Filter nur auf state=favorite
    const filter = col.find.mock.calls[0][0]
    expect(filter.state).toBe('favorite')
  })

  it('getAggregatedFavorites mit leerem fileIds gibt leere Maps', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.getAggregatedFavorites('lib-1', [])

    expect(res).toEqual({ counts: {}, voters: {} })
    expect(col.find).not.toHaveBeenCalled()
  })

  it('setState wirft fuer fehlende libraryId/fileId/userEmail', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    await expect(repo.setState('', 'f1', 'a@b.com', 'favorite')).rejects.toThrow(/libraryId/)
    await expect(repo.setState('lib', '', 'a@b.com', 'favorite')).rejects.toThrow(/libraryId/)
    await expect(repo.setState('lib', 'f1', '', 'favorite')).rejects.toThrow(/userEmail/)
  })
})
