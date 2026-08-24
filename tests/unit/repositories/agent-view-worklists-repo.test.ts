import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unit-Tests fuer `agent-view-worklists-repo.ts` — ohne echte MongoDB
 * (`getCollection` gemockt, Muster `source-user-states-repo.test.ts`).
 *
 * Kern ist die Idempotenz-Semantik von add/remove (Test-Befund 24.08.):
 * `unchanged` muss aus `matchedCount` kommen, mit der Mitgliedschaft im
 * QUERY — `modifiedCount` taugt nicht, weil das `$set` auf `updatedAt`
 * sonst jeden wirkungslosen Aufruf als Aenderung zaehlt und stempelt.
 */

interface MockCollection {
  findOne: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
}

const LISTE = {
  libraryId: 'lib-1', userEmail: 'peter@example.com', listId: 'l-1', name: 'Aufraeumen',
  position: 0, folders: [], createdAt: 'C', updatedAt: 'U',
}

function buildMockCollection(): MockCollection {
  return {
    findOne: vi.fn().mockResolvedValue(LISTE),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
  }
}

async function repoMit(col: MockCollection) {
  vi.doMock('@/lib/mongodb-service', () => ({
    getCollection: vi.fn().mockResolvedValue(col),
  }))
  return import('@/lib/repositories/agent-view-worklists-repo')
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('removeFolderFromWorklist — unchanged aus matchedCount, Mitgliedschaft im Query', () => {
  it('traegt die Mitgliedschaft im Query und meldet einen Treffer als Aenderung', async () => {
    const col = buildMockCollection()
    const repo = await repoMit(col)
    const result = await repo.removeFolderFromWorklist('lib-1', 'peter@example.com', 'l-1', 'f-1')

    expect(col.updateOne.mock.calls[0][0]).toEqual({
      userEmail: 'peter@example.com', listId: 'l-1', 'folders.folderId': 'f-1',
    })
    expect(result).toEqual({ list: LISTE, unchanged: false })
  })

  it('wirkungsloses Entfernen ist unchanged: true — kein Treffer heisst auch kein updatedAt-Stempel', async () => {
    const col = buildMockCollection()
    col.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0 })
    const repo = await repoMit(col)
    const result = await repo.removeFolderFromWorklist('lib-1', 'peter@example.com', 'l-1', 'f-fremd')

    expect(result).toEqual({ list: LISTE, unchanged: true })
  })

  it('unbekannte Liste liefert null (Route: 404), nicht unchanged', async () => {
    const col = buildMockCollection()
    col.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0 })
    col.findOne.mockResolvedValue(null)
    const repo = await repoMit(col)
    expect(await repo.removeFolderFromWorklist('lib-1', 'peter@example.com', 'l-weg', 'f-1')).toBeNull()
  })
})

describe('addFolderToWorklist — dieselbe Bauart', () => {
  it('Doppel-Aufnahme ist unchanged: true ueber den $ne-Guard im Query', async () => {
    const col = buildMockCollection()
    col.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0 })
    const repo = await repoMit(col)
    const result = await repo.addFolderToWorklist('lib-1', 'peter@example.com', 'l-1', {
      folderId: 'f-1', pathSnapshot: 'A/P', name: 'P',
    })

    expect(col.updateOne.mock.calls[0][0]).toEqual({
      userEmail: 'peter@example.com', listId: 'l-1', 'folders.folderId': { $ne: 'f-1' },
    })
    expect(result).toEqual({ list: LISTE, unchanged: true })
  })
})
