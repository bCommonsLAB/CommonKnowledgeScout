/**
 * Unit-Tests fuer `ExternalJobsRepository.claimNextQueuedJob` mit gerechter
 * Platzvergabe je Library (Owner 20.11.2026) und fuer die Mongo-Abfragen in
 * `external-jobs/fair-share-queries.ts`.
 *
 * Die Collection ist gemockt (Muster wie `reaper.test.ts`). `aggregate` wird
 * zweimal gerufen: einmal fuer wartende Jobs, einmal fuer laufende — der Stub
 * unterscheidet am `$match.status` der ersten Stufe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type AnyFn = ReturnType<typeof vi.fn>

interface MockCollection {
  createIndex: AnyFn
  aggregate: AnyFn
  updateOne: AnyFn
  findOne: AnyFn
}

interface PipelineStage {
  $match?: { status?: string }
  $sort?: Record<string, number>
}

function buildMockCollection(queuedRows: unknown[], runningRows: unknown[]): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    aggregate: vi.fn((pipeline: PipelineStage[]) => {
      const status = pipeline[0]?.$match?.status
      const rows = status === 'queued' ? queuedRows : status === 'running' ? runningRows : []
      return { toArray: vi.fn().mockResolvedValue(rows) }
    }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    findOne: vi.fn(async (filter: { jobId: string }) => ({ jobId: filter.jobId, status: 'running' })),
  }
}

const loggerError = vi.fn()

async function loadRepo(col: MockCollection) {
  vi.doMock('@/lib/mongodb-service', () => ({
    getCollection: vi.fn().mockResolvedValue(col),
  }))
  vi.doMock('@/lib/debug/logger', () => ({
    FileLogger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  }))
  const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
  return new ExternalJobsRepository()
}

describe('claimNextQueuedJob — gerechte Platzvergabe je Library', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('gibt den Platz der Library mit den wenigsten laufenden Jobs, nicht dem aeltesten Job', async () => {
    const col = buildMockCollection(
      [
        { _id: 'lib-a', jobId: 'a-0007', oldestQueuedAt: new Date('2026-11-20T06:00:00Z') },
        { _id: 'lib-b', jobId: 'b-0001', oldestQueuedAt: new Date('2026-11-20T10:00:00Z') },
      ],
      [{ _id: 'lib-a', running: 6 }],
    )
    const repo = await loadRepo(col)

    const claimed = await repo.claimNextQueuedJob()

    expect(claimed?.jobId).toBe('b-0001')
    expect(col.updateOne).toHaveBeenCalledTimes(1)
    const [filter, update] = col.updateOne.mock.calls[0] as [
      { jobId: string; status: string },
      { $set: { status: string } },
    ]
    expect(filter.jobId).toBe('b-0001')
    expect(filter.status).toBe('queued')
    expect(update.$set.status).toBe('running')
  })

  it('liest wartende Jobs im eigenen Pool, aelteste zuerst', async () => {
    const col = buildMockCollection([], [])
    const repo = await loadRepo(col)

    await repo.claimNextQueuedJob()

    const pipelines = col.aggregate.mock.calls.map((c) => c[0] as PipelineStage[])
    const queued = pipelines.find((p) => p[0]?.$match?.status === 'queued')
    const running = pipelines.find((p) => p[0]?.$match?.status === 'running')
    expect(queued).toBeDefined()
    expect(running).toBeDefined()
    // Pool-Filter (Default-Pool = $or ueber workerPoolId) muss in beiden Abfragen stecken.
    expect(queued?.[0]?.$match).toHaveProperty('$or')
    expect(running?.[0]?.$match).toHaveProperty('$or')
    expect(queued?.[1]?.$sort).toEqual({ updatedAt: 1 })
  })

  it('liefert null und schreibt nichts, wenn niemand wartet', async () => {
    const col = buildMockCollection([], [{ _id: 'lib-a', running: 2 }])
    const repo = await loadRepo(col)

    expect(await repo.claimNextQueuedJob()).toBeNull()
    expect(col.updateOne).not.toHaveBeenCalled()
  })

  it('liefert null, wenn ein paralleler Claim den Job schon genommen hat', async () => {
    const col = buildMockCollection(
      [{ _id: 'lib-a', jobId: 'a-1', oldestQueuedAt: new Date('2026-11-20T06:00:00Z') }],
      [],
    )
    col.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 0 })
    const repo = await loadRepo(col)

    expect(await repo.claimNextQueuedJob()).toBeNull()
    expect(col.findOne).not.toHaveBeenCalled()
  })

  it('meldet Datenfehler laut: kaputte jobId wird ausgelassen, unlesbares updatedAt zaehlt als aeltester', async () => {
    const col = buildMockCollection(
      [
        { _id: 'lib-kaputt', jobId: 123, oldestQueuedAt: new Date('2026-11-20T05:00:00Z') },
        { _id: 'lib-a', jobId: 'a-1', oldestQueuedAt: new Date('2026-11-20T06:00:00Z') },
        { _id: 'lib-b', jobId: 'b-1', oldestQueuedAt: 'kein-datum' },
      ],
      [],
    )
    const repo = await loadRepo(col)

    const claimed = await repo.claimNextQueuedJob()

    // b-1 mit unlesbarem Zeitpunkt gilt als „wartet am laengsten" und wird bedient.
    expect(claimed?.jobId).toBe('b-1')
    const meldungen = loggerError.mock.calls.map((c) => String(c[1]))
    expect(meldungen.some((m) => m.includes('"jobId"'))).toBe(true)
    expect(meldungen.some((m) => m.includes('"updatedAt"'))).toBe(true)
  })

  it('wandelt updatedAt als ISO-String in ein Datum um', async () => {
    const col = buildMockCollection(
      [
        { _id: 'lib-a', jobId: 'a-1', oldestQueuedAt: '2026-11-20T09:00:00.000Z' },
        { _id: 'lib-b', jobId: 'b-1', oldestQueuedAt: new Date('2026-11-20T08:00:00Z') },
      ],
      [],
    )
    const repo = await loadRepo(col)

    expect((await repo.claimNextQueuedJob())?.jobId).toBe('b-1')
    expect(loggerError).not.toHaveBeenCalled()
  })
})
