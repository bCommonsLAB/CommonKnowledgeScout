/**
 * @fileoverview Unit-Tests: `ingest` als Pflicht-Argument der Job-Bauer (Welle I1).
 *
 * Owner 11.10.2026: Ingest ist nie automatisch. Die Bauer setzen
 * `phases.ingest` und `policies.ingest` NUR aus dem Argument; ein
 * `ingest: true` ohne Vorlage ist ein Widerspruch, kein stiller Verfall.
 */

import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn(async (_job: Record<string, unknown>) => {}) }))
vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    create = mocks.create
    hashSecret = () => 'hash'
  },
}))

import { enqueueSourceDocumentJob } from '@/lib/external-jobs/enqueue-document-job'
import { buildSourceMarkdownJob } from '@/lib/external-jobs/enqueue-markdown-job'
import { buildSourceTranscribeJob, buildTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'

const BASE = {
  jobId: 'j1', jobSecretHash: 'h1', libraryId: 'lib', userEmail: 'a@b.c',
  source: { itemId: 's1', parentId: 'p1', name: 'Vortrag.m4a' },
}

interface MitSchaltern {
  phases?: { ingest?: boolean }
  policies?: { ingest?: string; metadata?: string }
}

describe('buildSourceTranscribeJob — ingest', () => {
  it('mit Vorlage und ingest: false transformiert, ingestiert aber nicht', () => {
    const p = buildSourceTranscribeJob({ ...BASE, mediaType: 'audio', template: 't', ingest: false }).parameters as MitSchaltern
    expect(p.phases?.ingest).toBe(false)
    expect(p.policies).toMatchObject({ metadata: 'do', ingest: 'ignore' })
  })

  it('mit Vorlage und ingest: true ingestiert', () => {
    const p = buildSourceTranscribeJob({ ...BASE, mediaType: 'audio', template: 't', ingest: true }).parameters as MitSchaltern
    expect(p.phases?.ingest).toBe(true)
    expect(p.policies?.ingest).toBe('do')
  })

  it('ingest: true ohne Vorlage ist ein Fehler, kein stiller Verfall', () => {
    expect(() => buildSourceTranscribeJob({ ...BASE, mediaType: 'audio', ingest: true })).toThrow(/ohne Vorlage/)
  })
})

describe('buildTemplateOnTextJob — ingest', () => {
  it('ingest: false → Transformation ohne Galerie-Eintrag, Schritte vorhanden', () => {
    const job = buildTemplateOnTextJob({ ...BASE, template: 't', ingest: false })
    expect(job.parameters).toMatchObject({ phases: { template: true, ingest: false }, policies: { metadata: 'do', ingest: 'ignore' } })
    expect(job.steps?.map((s) => s.name)).toEqual(['extract_pdf', 'transform_template', 'ingest_rag'])
  })

  it('ingest: true → wie bisher', () => {
    const job = buildTemplateOnTextJob({ ...BASE, template: 't', ingest: true })
    expect(job.parameters).toMatchObject({ phases: { ingest: true }, policies: { ingest: 'do' } })
  })
})

describe('buildSourceMarkdownJob — ingest', () => {
  it('ingest: false → phases.ingest false, policies.ingest ignore', () => {
    const job = buildSourceMarkdownJob({ ...BASE, source: { ...BASE.source, name: 'Seite.md' }, template: 't', ingest: false })
    expect(job.parameters).toMatchObject({ phases: { extract: false, template: true, ingest: false }, policies: { ingest: 'ignore' } })
  })

  it('ingest: true → phases.ingest true, policies.ingest do', () => {
    const job = buildSourceMarkdownJob({ ...BASE, source: { ...BASE.source, name: 'Seite.md' }, template: 't', ingest: true })
    expect(job.parameters).toMatchObject({ phases: { ingest: true }, policies: { ingest: 'do' } })
  })
})

describe('enqueueSourceDocumentJob — ingest', () => {
  it('ingest: false mit Vorlage → Transformation, kein Ingest', async () => {
    mocks.create.mockClear()
    await enqueueSourceDocumentJob({
      libraryId: 'lib', userEmail: 'a@b.c', source: { ...BASE.source, name: 'Folien.pdf' },
      mediaKind: 'pdf', template: 't', ingest: false,
    })
    const job = mocks.create.mock.calls[0][0] as unknown as { parameters: MitSchaltern }
    expect(job.parameters.phases?.ingest).toBe(false)
    expect(job.parameters.policies).toMatchObject({ metadata: 'do', ingest: 'ignore' })
  })

  it('ingest: true ohne Vorlage → Fehler, kein Job', async () => {
    mocks.create.mockClear()
    await expect(enqueueSourceDocumentJob({
      libraryId: 'lib', userEmail: 'a@b.c', source: { ...BASE.source, name: 'Folien.pdf' }, mediaKind: 'pdf', ingest: true,
    })).rejects.toThrow(/ohne Vorlage/)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
