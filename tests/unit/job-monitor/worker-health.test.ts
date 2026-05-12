/**
 * Tests fuer `computeWorkerHealth` aus `job-monitor-worker-status.tsx`.
 *
 * Verifiziert insbesondere die neue Diagnose `pool_concurrency_blocked`,
 * die vor der generischen `queued_stale` greift, wenn Zombie-Jobs
 * (stale running) die globalen Worker-Slots blockieren.
 */
import { describe, it, expect } from 'vitest'
import {
  computeWorkerHealth,
  type JobWorkerApiStatus,
  type JobMonitorServerCounters,
} from '@/components/shared/job-monitor-worker-status'

const NOW = new Date('2026-05-12T15:00:00.000Z').getTime()

function baseStatus(overrides: Partial<JobWorkerApiStatus> = {}): JobWorkerApiStatus {
  return {
    state: 'running',
    stats: { processed: 0, errors: 0, lastTickAt: NOW - 2000 },
    concurrency: 6,
    intervalMs: 2000,
    workerId: 'w1',
    jobsWorkerPoolId: 'default',
    reaperMaxAgeMs: 30 * 60 * 1000,
    reaperEveryNTicks: 10,
    ...overrides,
  }
}

function counters(queued: number, running = 0): JobMonitorServerCounters {
  return {
    queued,
    running,
    completed: 0,
    failed: 0,
    pendingStorage: 0,
    total: queued + running,
  }
}

describe('computeWorkerHealth — pool_concurrency_blocked', () => {
  it('meldet pool_concurrency_blocked, wenn Pool voll UND staleRunning>0', () => {
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        pool: { runningInPool: 6, staleRunningInPool: 6, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: counters(3, 0),
      nowMs: NOW,
    })

    expect(issue?.kind).toBe('pool_concurrency_blocked')
    expect(issue?.message).toContain('6/6')
    expect(issue?.message).toContain('Karteileichen')
    expect(issue?.message).toContain('30 Min')
  })

  it('meldet pool_concurrency_blocked nicht, wenn staleRunning=0 (legitim ausgelastet)', () => {
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        pool: { runningInPool: 6, staleRunningInPool: 0, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: counters(3, 0),
      nowMs: NOW,
    })

    // Pool voll, aber alles legitim → kein Health-Issue
    expect(issue).toBeNull()
  })

  it('meldet pool_concurrency_blocked nicht, wenn Pool nicht voll', () => {
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        pool: { runningInPool: 3, staleRunningInPool: 2, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: counters(3, 0),
      nowMs: NOW,
    })

    expect(issue).toBeNull()
  })

  it('verwendet Singular „Karteileiche“ bei genau 1 Stale-Running', () => {
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        concurrency: 1,
        pool: { runningInPool: 1, staleRunningInPool: 1, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: counters(2, 0),
      nowMs: NOW,
    })

    expect(issue?.message).toContain('1 Karteileiche ')
    expect(issue?.message).not.toContain('Karteileichen')
  })

  it('pool_concurrency_blocked verdraengt queued_stale (spezifischere Meldung gewinnt)', () => {
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString()
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        pool: { runningInPool: 6, staleRunningInPool: 4, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: {
        ...counters(3, 0),
        oldestQueuedUpdatedAt: oneHourAgo,
      },
      nowMs: NOW,
    })

    expect(issue?.kind).toBe('pool_concurrency_blocked')
  })

  it('faellt durch zu queued_stale, wenn kein Pool-Status verfuegbar ist', () => {
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString()
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({ pool: undefined }),
      workerFetchError: null,
      counters: {
        ...counters(3, 0),
        oldestQueuedUpdatedAt: oneHourAgo,
      },
      nowMs: NOW,
    })

    expect(issue?.kind).toBe('queued_stale')
  })

  it('worker_stopped hat hoechste Prioritaet (vor pool_concurrency_blocked)', () => {
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        state: 'stopped',
        pool: { runningInPool: 6, staleRunningInPool: 6, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: counters(3, 0),
      nowMs: NOW,
    })

    expect(issue?.kind).toBe('worker_stopped')
  })

  it('liefert null, wenn keine Queue (Pool-Saettigung ist dann egal)', () => {
    const issue = computeWorkerHealth({
      workerStatus: baseStatus({
        pool: { runningInPool: 6, staleRunningInPool: 6, staleThresholdMs: 30 * 60 * 1000 },
      }),
      workerFetchError: null,
      counters: counters(0, 0),
      nowMs: NOW,
    })

    expect(issue).toBeNull()
  })
})
