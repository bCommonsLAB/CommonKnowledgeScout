import { describe, expect, it } from 'vitest'
import { getJobsWorkerPoolId, workerPoolMongoMatch } from '@/lib/env'

describe('workerPoolMongoMatch', () => {
  it('default pool match erlaubt Legacy ohne Feld', () => {
    const m = workerPoolMongoMatch('default')
    expect(m).toHaveProperty('$or')
    const ors = (m as { $or: unknown[] }).$or
    expect(Array.isArray(ors)).toBe(true)
    expect(ors.length).toBeGreaterThanOrEqual(2)
  })

  it('benannte Pools matchen exakt workerPoolId', () => {
    expect(workerPoolMongoMatch('app-desktop-a')).toEqual({ workerPoolId: 'app-desktop-a' })
  })
})

describe('getJobsWorkerPoolId', () => {
  it('ohne ENV: default', () => {
    const prev = process.env.JOBS_WORKER_POOL_ID
    delete process.env.JOBS_WORKER_POOL_ID
    expect(getJobsWorkerPoolId()).toBe('default')
    if (prev !== undefined) process.env.JOBS_WORKER_POOL_ID = prev
  })

  it('trimmt gesetzte ENV', () => {
    const prev = process.env.JOBS_WORKER_POOL_ID
    process.env.JOBS_WORKER_POOL_ID = '  my-pool  '
    expect(getJobsWorkerPoolId()).toBe('my-pool')
    if (prev !== undefined) process.env.JOBS_WORKER_POOL_ID = prev
    else delete process.env.JOBS_WORKER_POOL_ID
  })
})
