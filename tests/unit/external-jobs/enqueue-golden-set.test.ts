/**
 * Welle F — Golden-Set-Job: Builder-Form, Optionen typgeprueft zurueck,
 * kaputte Jobs fallen laut.
 */
import { describe, it, expect } from 'vitest'
import { buildGoldenSetJob, leseGoldenSetOptionen } from '@/lib/external-jobs/enqueue-golden-set'
import { berichtDateiname } from '@/lib/external-jobs/phase-golden-set'
import type { ExternalJob } from '@/types/external-job'

const OPTIONEN = {
  setSourceId: 'set-1', setParentId: 'ordner-1', setName: 'golden-set.json', titel: 'Baseline',
  baseline: true, retriever: 'auto' as const, temperature: 0.3, nur: ['q1'], richterModel: 'richter-x',
}

describe('buildGoldenSetJob', () => {
  it('baut einen in-process-Job mit einem Schritt und den Optionen in der Correlation', () => {
    const job = buildGoldenSetJob({ jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', optionen: OPTIONEN })
    expect(job).toMatchObject({ job_type: 'golden-set', operation: 'run', status: 'queued', steps: [{ name: 'golden_set', status: 'pending' }] })
    expect(job.correlation.source).toMatchObject({ itemId: 'set-1', parentId: 'ordner-1', name: 'Golden-Set: Baseline' })
    expect(leseGoldenSetOptionen({ ...job, createdAt: new Date(), updatedAt: new Date() } as ExternalJob)).toEqual(OPTIONEN)
  })

  it('wirft ohne Titel und bei unvollstaendigen Optionen', () => {
    expect(() => buildGoldenSetJob({ jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', optionen: { ...OPTIONEN, titel: ' ' } })).toThrow(/titel ist Pflicht/)
    const kaputt = { correlation: { options: { setSourceId: 'x' } } } as unknown as ExternalJob
    expect(() => leseGoldenSetOptionen(kaputt)).toThrow(/ohne setSourceId/)
    const falscherRetriever = { correlation: { options: { ...OPTIONEN, retriever: 'alles' } } } as unknown as ExternalJob
    expect(() => leseGoldenSetOptionen(falscherRetriever)).toThrow(/unbekanntem retriever/)
  })
})

describe('berichtDateiname', () => {
  it('legt den Bericht neben das Set, mit Zeit und Titel', () => {
    expect(berichtDateiname('golden-set.json', 'Regeln v2', new Date('2026-10-08T09:05:00Z'))).toBe('golden-set-lauf-2026-10-08-09-05-Regeln_v2.md')
  })
})
