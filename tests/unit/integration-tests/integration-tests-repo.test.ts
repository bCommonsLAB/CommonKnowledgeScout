import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unit-Tests für `integration-tests-repo.ts`
 *
 * WICHTIG:
 * - Wir testen hier bewusst ohne echte MongoDB.
 * - Stattdessen mocken wir `getCollection()` und prüfen die Query-/Update-Calls.
 */

type MockCollection = {
  createIndex: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
  findOne: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
}

function buildMockCollection(): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn(),
  }
}

describe('integration-tests-repo', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('upsertIntegrationTestRun erstellt Indexe und upsertet per runId', async () => {
    const col = buildMockCollection()

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/integration-tests-repo')

    await repo.upsertIntegrationTestRun({
      runId: 'run-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      userEmail: 'test@example.com',
      libraryId: 'lib-1',
      folderId: 'root',
      testCaseIds: ['tc1'],
      result: { summary: { total: 1, passed: 1, failed: 0, skipped: 0 }, results: [] } as any,
      notes: [],
    })

    // Indexe werden im ersten Call initialisiert
    expect(col.createIndex).toHaveBeenCalled()

    // Upsert-Update: runId ist Key, upsert=true
    expect(col.updateOne).toHaveBeenCalledWith(
      { runId: 'run-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          runId: 'run-1',
          libraryId: 'lib-1',
        }),
      }),
      { upsert: true }
    )

    // Notes dürfen NICHT via $set überschrieben werden (sonst Data-Loss/Path-Conflict)
    const update = col.updateOne.mock.calls[0]?.[1] as any
    expect(update?.$set?.notes).toBeUndefined()
    expect(update?.$setOnInsert?.notes).toBeUndefined()
  })

  it('listIntegrationTestRunsFromDb baut Query/Sort/Limit korrekt', async () => {
    const col = buildMockCollection()
    const toArray = vi.fn().mockResolvedValue([{ runId: 'run-2' }])
    const limit = vi.fn().mockReturnValue({ toArray })
    const sort = vi.fn().mockReturnValue({ limit })
    col.find.mockReturnValue({ sort })

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/integration-tests-repo')

    const res = await repo.listIntegrationTestRunsFromDb({
      limit: 25,
      libraryId: 'lib-1',
      folderId: 'cGRm',
    })

    expect(col.find).toHaveBeenCalledWith({ libraryId: 'lib-1', folderId: 'cGRm' })
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(limit).toHaveBeenCalledWith(25)
    expect(res).toEqual([{ runId: 'run-2' }])
  })

  it('appendIntegrationTestRunNote pusht Note und lädt aktualisierten Run', async () => {
    const col = buildMockCollection()
    col.findOne.mockResolvedValue({ runId: 'run-3', notes: [{ noteId: 'n1' }] })

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const repo = await import('@/lib/repositories/integration-tests-repo')

    const updated = await repo.appendIntegrationTestRunNote({
      runId: 'run-3',
      note: {
        noteId: 'n1',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        authorType: 'agent',
        analysisMarkdown: 'a',
        nextStepsMarkdown: 'b',
      },
    })

    expect(col.updateOne).toHaveBeenCalledWith(
      { runId: 'run-3' },
      { $push: { notes: expect.objectContaining({ noteId: 'n1' }) } }
    )
    expect(col.findOne).toHaveBeenCalledWith({ runId: 'run-3' })
    expect(updated).toEqual({ runId: 'run-3', notes: [{ noteId: 'n1' }] })
  })
})

