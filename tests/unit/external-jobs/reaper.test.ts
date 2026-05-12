/**
 * Unit-Tests fuer den Stale-Running-Reaper im `ExternalJobsRepository`.
 *
 * Hintergrund:
 * Der per-Job-Watchdog ist in-process (`globalThis.__jobWatchdog`) und stirbt mit dem Node-
 * Prozess. Bei Redeploy/HMR/Crash bleiben so Jobs fuer immer in `running` und blockieren
 * die globale Concurrency. Der Reaper raeumt sie DB-seitig auf.
 *
 * Diese Tests verifizieren:
 * 1. Reaper findet stale `running`-Jobs und setzt sie auf `failed` mit eindeutigem error.code.
 * 2. Trace-Event `stale_running_reaped` wird pro Job geschrieben.
 * 3. Race-Safety: Wenn der Status zwischen find und update wechselt (modifiedCount=0),
 *    wird der Job NICHT in `ids` aufgenommen.
 * 4. `countStaleRunning` schlaegt mit `maxAgeMs <= 0` deterministisch 0 zurueck (keine DB-Query).
 * 5. `reapStaleRunning` ist No-Op bei leerer Treffermenge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type AnyFn = ReturnType<typeof vi.fn>

interface MockCollection {
  createIndex: AnyFn
  find: AnyFn
  findOne: AnyFn
  updateOne: AnyFn
  countDocuments: AnyFn
}

function buildMockCollection(): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(0),
  }
}

/**
 * Baut einen find()-Stub, der eine Liste stale Jobs zurueckliefert.
 * Aufrufschema im Repo: `col.find(match, { projection }).limit(50).toArray()`.
 */
function stubFindReturnsToArray(col: MockCollection, docs: unknown[]) {
  const toArray = vi.fn().mockResolvedValue(docs)
  const limit = vi.fn().mockReturnValue({ toArray })
  col.find.mockReturnValue({ limit })
  return { limit, toArray }
}

describe('ExternalJobsRepository — Reaper (stale_running_reaped)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('setzt stale running-Jobs auf failed und meldet sie zurueck', async () => {
    const col = buildMockCollection()
    const now = new Date('2026-05-12T15:00:00.000Z')
    const veryOld = new Date('2026-05-12T14:00:00.000Z') // 60 Min alt
    stubFindReturnsToArray(col, [
      { jobId: 'job-zombie-1', updatedAt: veryOld, userEmail: 'a@x' },
      { jobId: 'job-zombie-2', updatedAt: veryOld, userEmail: 'b@x' },
    ])
    // updateOne wird mehrfach gerufen: Reaper-Failed, Trace-Span-End, Trace-Event-Push.
    // Alle liefern modifiedCount: 1.
    col.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })

    vi.useFakeTimers()
    vi.setSystemTime(now)

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    const result = await repo.reapStaleRunning(30 * 60 * 1000, { workerId: 'w-test' })

    expect(result.reaped).toBe(2)
    expect(result.ids).toEqual(['job-zombie-1', 'job-zombie-2'])

    // Erster updateOne pro Job = Failed-Update mit eindeutigem error.code
    const failedUpdates = col.updateOne.mock.calls.filter(
      (call) =>
        call[0]?.status === 'running' &&
        (call[1] as { $set?: { status?: string } })?.$set?.status === 'failed',
    )
    expect(failedUpdates).toHaveLength(2)
    for (const call of failedUpdates) {
      const update = call[1] as { $set?: { error?: { code?: string; details?: { reaperWorkerId?: string } } } }
      expect(update.$set?.error?.code).toBe('stale_running_reaped')
      expect(update.$set?.error?.details?.reaperWorkerId).toBe('w-test')
    }

    vi.useRealTimers()
  })

  it('schreibt pro Job ein Trace-Event stale_running_reaped (level=error)', async () => {
    const col = buildMockCollection()
    stubFindReturnsToArray(col, [
      { jobId: 'job-zombie-1', updatedAt: new Date('2026-05-12T14:00:00.000Z'), userEmail: 'a@x' },
    ])
    col.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    await repo.reapStaleRunning(30 * 60 * 1000, { workerId: 'w-test' })

    // Trace-Event = updateOne mit $push auf trace.events
    const tracePushes = col.updateOne.mock.calls.filter((call) => {
      const update = call[1] as { $push?: { 'trace.events'?: { name?: string; level?: string } } }
      return update?.$push && 'trace.events' in update.$push
    })
    expect(tracePushes).toHaveLength(1)
    const evt = (tracePushes[0]?.[1] as { $push: { 'trace.events': { name: string; level: string; spanId: string } } })
      .$push['trace.events']
    expect(evt.name).toBe('stale_running_reaped')
    expect(evt.level).toBe('error')
    expect(evt.spanId).toBe('job')
  })

  it('zaehlt einen Job NICHT als reaped, wenn der Failed-Update zwischendurch verschwindet (race)', async () => {
    const col = buildMockCollection()
    stubFindReturnsToArray(col, [
      { jobId: 'job-a', updatedAt: new Date('2026-05-12T14:00:00.000Z'), userEmail: 'a@x' },
      { jobId: 'job-b', updatedAt: new Date('2026-05-12T14:00:00.000Z'), userEmail: 'b@x' },
    ])
    // job-a: Update geht durch (modifiedCount: 1)
    // job-b: Race — anderer Callback hat job-b schon completed (modifiedCount: 0)
    let call = 0
    col.updateOne.mockImplementation((filter: unknown) => {
      const f = filter as { jobId?: string; status?: string }
      if (f.status === 'running') {
        call += 1
        return Promise.resolve({
          acknowledged: true,
          modifiedCount: f.jobId === 'job-a' ? 1 : 0,
        })
      }
      return Promise.resolve({ acknowledged: true, modifiedCount: 1 })
    })

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    const result = await repo.reapStaleRunning(30 * 60 * 1000)

    expect(result.reaped).toBe(1)
    expect(result.ids).toEqual(['job-a'])
    expect(call).toBe(2)
  })

  it('ist No-Op bei leerer Treffermenge (kein updateOne)', async () => {
    const col = buildMockCollection()
    stubFindReturnsToArray(col, [])

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    const result = await repo.reapStaleRunning(30 * 60 * 1000)

    expect(result.reaped).toBe(0)
    expect(result.ids).toEqual([])
    expect(col.updateOne).not.toHaveBeenCalled()
  })

  it('reapStaleRunning(0) liefert sofort 0 zurueck (keine DB-Query)', async () => {
    const col = buildMockCollection()

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    const result = await repo.reapStaleRunning(0)

    expect(result.reaped).toBe(0)
    expect(col.find).not.toHaveBeenCalled()
  })
})

describe('ExternalJobsRepository — countStaleRunning', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('uebersetzt maxAgeMs in updatedAt-Cutoff', async () => {
    const col = buildMockCollection()
    col.countDocuments.mockResolvedValue(3)

    const fixedNow = new Date('2026-05-12T15:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    const count = await repo.countStaleRunning(30 * 60 * 1000)

    expect(count).toBe(3)
    const filter = col.countDocuments.mock.calls[0]?.[0] as {
      status?: string
      updatedAt?: { $lt?: Date }
    }
    expect(filter.status).toBe('running')
    expect(filter.updatedAt?.$lt).toBeInstanceOf(Date)
    expect(filter.updatedAt?.$lt?.getTime()).toBe(fixedNow.getTime() - 30 * 60 * 1000)

    vi.useRealTimers()
  })

  it('liefert 0 ohne DB-Query bei maxAgeMs<=0', async () => {
    const col = buildMockCollection()

    vi.doMock('@/lib/mongodb-service', () => ({
      getCollection: vi.fn().mockResolvedValue(col),
    }))

    const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
    const repo = new ExternalJobsRepository()

    expect(await repo.countStaleRunning(0)).toBe(0)
    expect(await repo.countStaleRunning(-1)).toBe(0)
    expect(col.countDocuments).not.toHaveBeenCalled()
  })
})
