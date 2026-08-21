/**
 * @fileoverview Unit-Tests: Dokument-Jobs fuer die MCP-Bruecke (A1).
 *
 * Die Job-Form muss der Pipeline-Route entsprechen (Worker laedt das Binary
 * upload-frei ueber itemId) — Typ-Erkennung und Job-Gestalt je Dokument-Art.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(async () => {}),
  hashSecret: vi.fn(() => 'hash'),
}))

vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    create = mocks.create
    hashSecret = mocks.hashSecret
  },
}))

import {
  documentMediaKindFromName,
  enqueueSourceDocumentJob,
} from '@/lib/external-jobs/enqueue-document-job'

const SOURCE = { itemId: 'item-1', parentId: 'parent-1', name: 'Programm.pdf' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('documentMediaKindFromName (A1)', () => {
  it('erkennt die vier Dokument-Arten, case-insensitiv', () => {
    expect(documentMediaKindFromName('a.pdf')).toBe('pdf')
    expect(documentMediaKindFromName('B.DOCX')).toBe('docx')
    expect(documentMediaKindFromName('c.xlsx')).toBe('xlsx')
    expect(documentMediaKindFromName('d.pptx')).toBe('pptx')
  })

  it('alles andere ist kein Bruecken-Dokument (null, kein Raten)', () => {
    expect(documentMediaKindFromName('audio.m4a')).toBeNull()
    expect(documentMediaKindFromName('alt.doc')).toBeNull()
    expect(documentMediaKindFromName('notiz.md')).toBeNull()
    expect(documentMediaKindFromName('pdf')).toBeNull()
  })
})

describe('enqueueSourceDocumentJob (A1)', () => {
  it('PDF-Job traegt die Pipeline-Form: job_type pdf, extract_pdf, Mistral-OCR-Parameter', async () => {
    const { jobId } = await enqueueSourceDocumentJob({
      libraryId: 'lib-1', userEmail: 'peter@example.com', source: SOURCE,
      mediaKind: 'pdf', template: 'standard-meeting',
    })
    expect(jobId).toBeTruthy()
    const job = mocks.create.mock.calls[0][0] as Record<string, unknown>
    expect(job).toMatchObject({
      job_type: 'pdf', operation: 'extract', worker: 'secretary', status: 'queued',
    })
    const steps = job.steps as Array<{ name: string }>
    expect(steps.map((s) => s.name)).toEqual(['extract_pdf', 'transform_template', 'ingest_rag'])
    expect(job.parameters).toMatchObject({
      template: 'standard-meeting',
      extractionMethod: 'mistral_ocr',
      phases: { extract: true, template: true, ingest: true },
      policies: { extract: 'do', metadata: 'do', ingest: 'do' },
    })
    const correlation = job.correlation as { source: { itemId: string; mimeType: string } }
    expect(correlation.source.itemId).toBe('item-1')
    expect(correlation.source.mimeType).toBe('application/pdf')
  })

  it('Office-Job: job_type office, extract_office; ohne Template bleiben metadata/ingest ignore', async () => {
    await enqueueSourceDocumentJob({
      libraryId: 'lib-1', userEmail: 'peter@example.com',
      source: { ...SOURCE, name: 'Protokoll.docx' }, mediaKind: 'docx',
    })
    const job = mocks.create.mock.calls[0][0] as Record<string, unknown>
    expect(job.job_type).toBe('office')
    const steps = job.steps as Array<{ name: string }>
    expect(steps[0].name).toBe('extract_office')
    expect(job.parameters).toMatchObject({
      phases: { extract: true, template: false, ingest: false },
      policies: { extract: 'do', metadata: 'ignore', ingest: 'ignore' },
    })
    const correlation = job.correlation as { source: { mimeType: string }; options: Record<string, unknown> }
    expect(correlation.source.mimeType).toContain('wordprocessingml')
    expect(correlation.options).toMatchObject({ includeImages: true, includePreviews: true })
  })
})
