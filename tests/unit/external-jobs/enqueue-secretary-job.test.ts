/**
 * @fileoverview Unit-Tests: Job-Builder der MCP-Erschliessung (Welle 5, Stufe 2).
 *
 * Die Builder muessen EXAKT die Form der bestehenden Job-Routen erzeugen —
 * der External-Jobs-Worker ist der Konsument (Strangler unveraendert).
 */

import { describe, it, expect } from 'vitest'
import { buildSourceTranscribeJob, buildTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'

const BASE = {
  jobId: 'job-1',
  jobSecretHash: 'hash-1',
  libraryId: 'lib-1',
  userEmail: 'peter@example.org',
  source: { itemId: 'src-1', parentId: 'folder-1', name: 'Climaclub.m4a' },
}

describe('buildSourceTranscribeJob — Form der process-audio/video-Job-Routen', () => {
  it('ohne Template: Transcript-only (extract do, Rest ignore)', () => {
    const job = buildSourceTranscribeJob({ ...BASE, mediaType: 'audio' })
    expect(job).toMatchObject({
      job_type: 'audio', operation: 'transcribe', worker: 'secretary', status: 'queued',
    })
    expect(job.parameters).toMatchObject({
      policies: { extract: 'do', metadata: 'ignore', ingest: 'ignore' },
      phases: { extract: true, template: false, ingest: false, images: false },
    })
    expect(job.correlation.source).toMatchObject({
      mediaType: 'audio', itemId: 'src-1', parentId: 'folder-1', name: 'Climaclub.m4a',
    })
  })

  it('mit Template: voll erschliessen (extract+template+ingest)', () => {
    const job = buildSourceTranscribeJob({ ...BASE, mediaType: 'video', template: 'standard-meeting' })
    expect(job.job_type).toBe('video')
    expect(job.parameters).toMatchObject({
      template: 'standard-meeting',
      policies: { extract: 'do', metadata: 'do', ingest: 'do' },
      phases: { extract: true, template: true, ingest: true },
    })
  })
})

describe('buildTemplateOnTextJob — Form der process-text-Job-Route', () => {
  it('haengt an der QUELLE und ueberspringt die Extraktion', () => {
    const job = buildTemplateOnTextJob({ ...BASE, template: 'standard-meeting' })
    expect(job).toMatchObject({ job_type: 'text', operation: 'extract', status: 'queued' })
    expect(job.parameters).toMatchObject({
      template: 'standard-meeting',
      policies: { extract: 'ignore', metadata: 'do', ingest: 'do' },
      phases: { extract: false, template: true, ingest: true },
    })
    // Die Transformation landet an der Familie der Quelle, nicht an einer Textdatei.
    expect(job.correlation.source.itemId).toBe('src-1')
    expect(job.correlation.source.mediaType).toBe('markdown')
  })

  it('leeres Template ist ein Fehler (kein stiller Transcript-only-Job)', () => {
    expect(() => buildTemplateOnTextJob({ ...BASE, template: '   ' })).toThrow(/template/)
  })
})
