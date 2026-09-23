/**
 * @fileoverview Fehlerbehandler ueberschreiben einen Abbruch von Hand nicht.
 *
 * Befund 23.09.2026: Wirft der Abbruch-Waechter im Abschluss, faengt die
 * Start-Route das mit `handleJobError(…, 'start_error')` — und der Grund, den
 * der Mensch bei `job_abbrechen` angegeben hat, waere weg.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({ FileLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/events/job-event-bus', () => ({ getJobEventBus: () => ({ emitUpdate: vi.fn() }) }))

import { handleJobError, handleJobErrorWithDetails } from '@/lib/external-jobs/error-handler'
import { ABBRUCH_VON_HAND_CODE } from '@/lib/external-jobs/job-abbruch-waechter'

function repoMit(job: Record<string, unknown>) {
  return {
    get: vi.fn(async () => job),
    setStatus: vi.fn(async () => true),
    traceAddEvent: vi.fn(async () => {}),
  }
}
const CTX = { jobId: 'j1', userEmail: 'u@example.org' }

beforeEach(() => vi.clearAllMocks())

describe('handleJobError / handleJobErrorWithDetails', () => {
  it('normaler Fehler: Status wird auf failed gesetzt', async () => {
    const repo = repoMit({ status: 'running' })
    await handleJobError(new Error('kaputt'), CTX, repo as never, 'start_error')
    expect(repo.setStatus).toHaveBeenCalledWith('j1', 'failed', expect.objectContaining({ error: expect.objectContaining({ code: 'start_error' }) }))
  })

  it('von Hand beendeter Job: Abbruchgrund bleibt, kein setStatus (beide Handler)', async () => {
    const job = { status: 'failed', error: { code: ABBRUCH_VON_HAND_CODE, message: 'Falsche Vorlage' } }
    const repo = repoMit(job)
    await handleJobError(new Error('Abschluss verweigert'), CTX, repo as never, 'start_error')
    await handleJobErrorWithDetails(new Error('x'), CTX, repo as never, 'template_error', { a: 1 })
    expect(repo.setStatus).not.toHaveBeenCalled()
    // Der Fehler wird trotzdem im Trace festgehalten.
    expect(repo.traceAddEvent).toHaveBeenCalledTimes(2)
  })

  it('anderer failed-Grund: wird wie bisher ueberschrieben', async () => {
    const repo = repoMit({ status: 'failed', error: { code: 'job_error', message: 'alt' } })
    await handleJobError(new Error('neu'), CTX, repo as never, 'start_error')
    expect(repo.setStatus).toHaveBeenCalledTimes(1)
  })
})
