import { describe, expect, it, vi } from 'vitest'
import { prepareSecretaryRequest } from '@/lib/external-jobs/secretary-request'
import type { ExternalJob } from '@/types/external-job'

vi.mock('@/lib/env', () => ({
  getSecretaryConfig: () => ({ baseUrl: 'http://127.0.0.1:5001/api', apiKey: 'test-key' }),
}))

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}))

function createFile(name: string, mimeType: string): File {
  return new File([new Blob(['x'], { type: mimeType })], name, { type: mimeType })
}

function createJob(partial: Partial<ExternalJob>): ExternalJob {
  const now = new Date()
  return {
    jobId: 'job-1',
    jobSecretHash: 'hash',
    job_type: 'pdf',
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: 'lib-1',
    userEmail: 'u@example.com',
    correlation: {
      jobId: 'job-1',
      libraryId: 'lib-1',
      source: { mediaType: 'pdf', name: 'doc.pdf', itemId: 'it-1', parentId: 'p-1' },
      options: {},
    },
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

function getStringField(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' ? v : null
}

describe('prepareSecretaryRequest', () => {
  it('builds PDF mistral_ocr request with callback', () => {
    const job = createJob({
      job_type: 'pdf',
      correlation: {
        jobId: 'job-pdf',
        libraryId: 'lib-1',
        source: { mediaType: 'pdf', name: 'doc.pdf', itemId: 'it1', parentId: 'p1' },
        options: { extractionMethod: 'mistral_ocr', includeOcrImages: true, includePageImages: true, useCache: true, targetLanguage: 'de' },
      },
    })

    const cfg = prepareSecretaryRequest(job, createFile('doc.pdf', 'application/pdf'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/pdf/process-mistral-ocr')
    expect(cfg.headers.Authorization).toContain('test-key')
    expect(getStringField(cfg.formData, 'callback_url')).toBe('https://app/cb')
    expect(getStringField(cfg.formData, 'callback_token')).toBe('secret')
  })

  it('does NOT send template to /audio/process when template-phase is enabled (handled in phase 2)', () => {
    const job = createJob({
      job_type: 'audio',
      correlation: {
        jobId: 'job-audio',
        libraryId: 'lib-1',
        source: { mediaType: 'audio', name: 'Analyse Asana.m4a', itemId: 'it2', parentId: 'p1' },
        options: { targetLanguage: 'de', sourceLanguage: 'auto', useCache: true },
      },
      parameters: { template: 'besprechung', phases: { extract: true, template: true, ingest: false } },
    })

    const cfg = prepareSecretaryRequest(job, createFile('Analyse Asana.m4a', 'audio/mp4'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/audio/process')
    expect(getStringField(cfg.formData, 'template')).toBeNull()
  })

  it('sends template to /audio/process when template-phase is disabled (extract-only shortcut)', () => {
    const job = createJob({
      job_type: 'audio',
      correlation: {
        jobId: 'job-audio2',
        libraryId: 'lib-1',
        source: { mediaType: 'audio', name: 'a.mp3', itemId: 'it2', parentId: 'p1' },
        options: { targetLanguage: 'de', sourceLanguage: 'auto', useCache: true },
      },
      parameters: { template: 'besprechung', phases: { extract: true, template: false, ingest: false } },
    })

    const cfg = prepareSecretaryRequest(job, createFile('a.mp3', 'audio/mpeg'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/audio/process')
    expect(getStringField(cfg.formData, 'template')).toBe('besprechung')
  })

  it('does NOT send template to /video/process when template-phase is enabled (handled in phase 2)', () => {
    const job = createJob({
      job_type: 'video',
      correlation: {
        jobId: 'job-video',
        libraryId: 'lib-1',
        source: { mediaType: 'video', name: 'v.mp4', itemId: 'it3', parentId: 'p1' },
        options: { targetLanguage: 'de', sourceLanguage: 'auto', useCache: false },
      },
      parameters: { template: 'besprechung', phases: { extract: true, template: true, ingest: false } },
    })

    const cfg = prepareSecretaryRequest(job, createFile('v.mp4', 'video/mp4'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/video/process')
    expect(getStringField(cfg.formData, 'template')).toBeNull()
  })
})

 