/**
 * Welle C — Builder des Ingest-only-Jobs: nur Phase 3, Transformation aus dem
 * Twin, Job-Typ aus dem Dateinamen, Vorlage Pflicht.
 */
import { describe, it, expect } from 'vitest'
import { buildIngestOnlyJob } from '@/lib/external-jobs/enqueue-ingest-job'

const BASE = {
  jobId: 'job-1', jobSecretHash: 'hash-1', libraryId: 'lib-1', userEmail: 'owner@example.org',
  source: { itemId: 'src-1', parentId: 'folder-1', name: 'Massnahme 38.pdf' },
  template: 'klimamassnahme', targetLanguage: 'de',
}

describe('buildIngestOnlyJob', () => {
  it('baut einen Job, der nur die Ingest-Phase faehrt und das Ingest-Gate erzwingt', () => {
    const job = buildIngestOnlyJob({ ...BASE, batchId: 'b-1' })
    expect(job).toMatchObject({ job_type: 'pdf', operation: 'extract', worker: 'secretary', status: 'queued' })
    expect(job.parameters).toEqual({
      targetLanguage: 'de', template: 'klimamassnahme',
      phases: { extract: false, template: false, ingest: true },
      policies: { extract: 'ignore', metadata: 'ignore', ingest: 'force' },
    })
    expect(job.steps.map((s) => s.name)).toEqual(['extract_pdf', 'transform_template', 'ingest_rag'])
    expect(job.correlation).toMatchObject({ batchId: 'b-1', source: { mediaType: 'pdf', itemId: 'src-1', parentId: 'folder-1' } })
  })

  it('nimmt den Extract-Schrittnamen aus dem Medientyp', () => {
    expect(buildIngestOnlyJob({ ...BASE, source: { ...BASE.source, name: 'Rede.m4a' } }).steps[0].name).toBe('extract_audio')
    expect(buildIngestOnlyJob({ ...BASE, source: { ...BASE.source, name: 'Notiz.md' } })).toMatchObject({ job_type: 'text' })
  })

  it('wirft ohne Vorlage und bei Dateien, die die Pipeline nicht kennt', () => {
    expect(() => buildIngestOnlyJob({ ...BASE, template: ' ' })).toThrow(/template ist Pflicht/)
    expect(() => buildIngestOnlyJob({ ...BASE, source: { ...BASE.source, name: 'daten.json' } })).toThrow(/kennt die Pipeline nicht/)
  })
})
