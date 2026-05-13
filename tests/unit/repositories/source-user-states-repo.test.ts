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
  updateMany: ReturnType<typeof vi.fn>
  deleteOne: ReturnType<typeof vi.fn>
}

function buildMockCollection(): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, upsertedCount: 0 }),
    updateMany: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 0 }),
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

  it('getAggregatedFavorites zaehlt nur favorite und liefert sortierte Voter mit Display-Name', async () => {
    const col = buildMockCollection()
    col.find = vi.fn().mockReturnValue(
      buildFindResult([
        { fileId: 'f1', userEmail: 'bernd@example.com', userDisplayName: 'Bernd Mustermann' },
        { fileId: 'f1', userEmail: 'anna@example.com', userDisplayName: 'Anna Apfel' },
        { fileId: 'f2', userEmail: 'carla@example.com' },
      ]),
    )
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.getAggregatedFavorites('lib-1', ['f1', 'f2', 'f3'])

    expect(res.counts).toEqual({ f1: 2, f2: 1 })
    // Voter sind FavoriteVoter[] mit name aus userDisplayName
    expect(res.voters.f1).toEqual([
      { email: 'anna@example.com', name: 'Anna Apfel' },
      { email: 'bernd@example.com', name: 'Bernd Mustermann' },
    ])
    // Fallback fuer fehlenden Display-Name = E-Mail-Prefix
    expect(res.voters.f2).toEqual([
      { email: 'carla@example.com', name: 'carla' },
    ])
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

  it('setState mit userDisplayName persistiert Name und macht Lazy-Backfill', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    await repo.setState('lib-1', 'f1', 'Anna@Example.com', 'favorite', {
      userDisplayName: 'Anna Apfel',
    })

    // Upsert enthaelt userDisplayName im $set
    expect(col.updateOne).toHaveBeenCalledTimes(1)
    const setFields = col.updateOne.mock.calls[0][1].$set
    expect(setFields).toMatchObject({ state: 'favorite', userDisplayName: 'Anna Apfel' })

    // Lazy-Backfill: updateMany aktualisiert ALLE Eintraege des Users
    expect(col.updateMany).toHaveBeenCalledTimes(1)
    expect(col.updateMany.mock.calls[0][0]).toEqual({
      libraryId: 'lib-1',
      userEmail: 'anna@example.com',
    })
    expect(col.updateMany.mock.calls[0][1]).toEqual({
      $set: { userDisplayName: 'Anna Apfel' },
    })
  })

  it('setState ohne userDisplayName ueberspringt das Backfill', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    await repo.setState('lib-1', 'f1', 'anna@example.com', 'favorite')

    expect(col.updateOne).toHaveBeenCalledTimes(1)
    // userDisplayName fehlt im $set
    const setFields = col.updateOne.mock.calls[0][1].$set
    expect(setFields).not.toHaveProperty('userDisplayName')
    // Kein Backfill ohne neuen Namen
    expect(col.updateMany).not.toHaveBeenCalled()
  })

  it('setState mit null + userDisplayName loescht Eintrag und backfillt parallele Eintraege', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/source-user-states-repo')
    const res = await repo.setState('lib-1', 'f1', 'anna@example.com', null, {
      userDisplayName: 'Anna Neu',
    })

    expect(res.state).toBeNull()
    expect(col.deleteOne).toHaveBeenCalledTimes(1)
    expect(col.updateMany).toHaveBeenCalledTimes(1)
    expect(col.updateMany.mock.calls[0][1]).toEqual({
      $set: { userDisplayName: 'Anna Neu' },
    })
  })

  describe('buildFavoriteLookupStages', () => {
    it('liefert Lookup + AddFields + Project, wenn userEmail vorhanden', async () => {
      const repo = await import('@/lib/repositories/source-user-states-repo')
      const stages = repo.buildFavoriteLookupStages('lib-1', 'Anna@Example.COM')

      expect(stages).toHaveLength(3)
      expect(stages[0]).toHaveProperty('$lookup')
      const lookup = stages[0].$lookup as Record<string, unknown>
      expect(lookup.from).toBe('source_user_states')
      // Pipeline-Filter enthaelt libraryId + state='favorite'
      const pipeline = lookup.pipeline as Array<Record<string, unknown>>
      expect(pipeline[0].$match).toBeDefined()

      // AddFields legt favoriteCount/Voters/isFavorite an
      expect(stages[1]).toHaveProperty('$addFields')
      const add = stages[1].$addFields as Record<string, unknown>
      expect(add).toHaveProperty('favoriteCount')
      expect(add).toHaveProperty('favoriteVoters')
      expect(add).toHaveProperty('isFavorite')

      // E-Mail wurde fuer den `$in`-Vergleich normalisiert (lower-case).
      const isFavExpr = add.isFavorite as { $in?: unknown[] }
      expect(isFavExpr.$in?.[0]).toBe('anna@example.com')
    })

    it('liefert leere Stages bei leerem userEmail (Datenschutz)', async () => {
      const repo = await import('@/lib/repositories/source-user-states-repo')
      expect(repo.buildFavoriteLookupStages('lib-1', '')).toEqual([])
      expect(repo.buildFavoriteLookupStages('lib-1', null)).toEqual([])
      expect(repo.buildFavoriteLookupStages('lib-1', undefined)).toEqual([])
    })

    it('wirft bei fehlender libraryId', async () => {
      const repo = await import('@/lib/repositories/source-user-states-repo')
      expect(() => repo.buildFavoriteLookupStages('', 'anna@example.com')).toThrow(/libraryId/)
    })
  })
})
