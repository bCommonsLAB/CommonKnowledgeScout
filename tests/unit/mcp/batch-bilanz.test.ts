/**
 * Welle A — `batch_bilanz`: Zaehler je Status, Fehler nach letzter Ursache
 * aus dem Trace gruppiert, Quellen je Gruppe, unbekannter Status wirft.
 */
import { describe, it, expect } from 'vitest'
import { bilanziereJobs } from '@/lib/mcp/batch-bilanz'
import type { ExternalJob } from '@/types/external-job'

function job(teil: Partial<ExternalJob> & { jobId: string; status: ExternalJob['status'] }): ExternalJob {
  return {
    jobSecretHash: 'h', job_type: 'pdf', operation: 'extract', worker: 'secretary', libraryId: 'lib', userEmail: 'u@x',
    correlation: { jobId: teil.jobId, libraryId: 'lib', source: { itemId: `src-${teil.jobId}`, name: `${teil.jobId}.pdf` } },
    createdAt: new Date(), updatedAt: new Date(), ...teil,
  } as ExternalJob
}

function mitTrace(j: ExternalJob, meldung: string, code = 'template_failed'): ExternalJob {
  return { ...j, trace: { events: [{ name: 'step_failed', attributes: { step: 'transform_template', error: meldung, errorCode: code } }] } } as ExternalJob
}

describe('bilanziereJobs', () => {
  it('zaehlt je Status und gruppiert Fehlschlaege nach Ursache, groesste Gruppe zuerst', () => {
    const bilanz = bilanziereJobs([
      job({ jobId: '1', status: 'completed' }),
      job({ jobId: '2', status: 'queued' }),
      mitTrace(job({ jobId: '3', status: 'failed' }), 'Kein Transkript am Twin'),
      mitTrace(job({ jobId: '4', status: 'failed' }), 'Kein Transkript am Twin'),
      mitTrace(job({ jobId: '5', status: 'failed' }), 'Worker-Timeout', 'timeout'),
    ])
    expect(bilanz.zaehler).toEqual({ queued: 1, running: 0, completed: 1, failed: 3, pendingStorage: 0, total: 5 })
    expect(bilanz.fehlerNachUrsache.map((g) => [g.ursache, g.anzahl])).toEqual([['Kein Transkript am Twin', 2], ['Worker-Timeout', 1]])
    expect(bilanz.fehlerNachUrsache[0]).toMatchObject({ code: 'template_failed', schritt: 'transform_template', jobIds: ['3', '4'] })
    expect(bilanz.fehlerNachUrsache[0].quellen).toEqual([{ sourceId: 'src-3', name: '3.pdf' }, { sourceId: 'src-4', name: '4.pdf' }])
  })

  it('faellt ohne Trace auf job.error zurueck und benennt Jobs ganz ohne Meldung', () => {
    const bilanz = bilanziereJobs([
      job({ jobId: '1', status: 'failed', error: { code: 'x', message: 'Aus job.error' } }),
      job({ jobId: '2', status: 'failed' }),
    ])
    expect(bilanz.fehlerNachUrsache.map((g) => g.ursache)).toEqual(['Aus job.error', 'ohne Fehlermeldung (alter Job ohne Trace?)'])
    expect(bilanz.fehlerNachUrsache[0].code).toBe('x')
  })

  it('wirft bei unbekanntem Status statt ihn still zu zaehlen', () => {
    expect(() => bilanziereJobs([job({ jobId: '1', status: 'kaputt' as ExternalJob['status'] })])).toThrow(/Unbekannter Job-Status/)
  })
})
