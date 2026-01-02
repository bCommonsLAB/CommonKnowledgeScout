import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => {
  return {
    getSecretaryConfig: () => ({ baseUrl: 'http://localhost:5001/api', apiKey: 'test-key' }),
  }
})

import { prepareSecretaryRequest } from '@/lib/external-jobs/secretary-request'

function createFile(name: string, type: string): File {
  return new File(['test'], name, { type })
}

describe('prepareSecretaryRequest', () => {
  it('builds PDF mistral_ocr request with callback', () => {
    const job = {
      jobId: 'job1',
      jobSecretHash: 'hash',
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId: 'lib1',
      userEmail: 'u@example.com',
      correlation: {
        jobId: 'job1',
        libraryId: 'lib1',
        source: { mediaType: 'pdf', name: 'doc.pdf', itemId: 'it1', parentId: 'p1' },
        options: { extractionMethod: 'mistral_ocr', includeOcrImages: true, includePageImages: true, useCache: true, targetLanguage: 'de' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const

    const cfg = prepareSecretaryRequest(job as any, createFile('doc.pdf', 'application/pdf'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/pdf/process-mistral-ocr')
    expect(cfg.headers.Authorization).toContain('test-key')
    expect(cfg.formData.get('callback_url')).toBe('https://app/cb')
    expect(cfg.formData.get('callback_token')).toBe('secret')
  })

  it('builds audio request with callback', () => {
    const job = {
      jobId: 'job2',
      jobSecretHash: 'hash',
      job_type: 'audio',
      operation: 'transcribe',
      worker: 'secretary',
      status: 'queued',
      libraryId: 'lib1',
      userEmail: 'u@example.com',
      correlation: {
        jobId: 'job2',
        libraryId: 'lib1',
        source: { mediaType: 'audio', name: 'a.mp3', itemId: 'it2', parentId: 'p1' },
        options: { targetLanguage: 'de', sourceLanguage: 'auto', useCache: true },
      },
      parameters: { template: 'Besprechung' },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const

    const cfg = prepareSecretaryRequest(job as any, createFile('a.mp3', 'audio/mpeg'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/audio/process')
    expect(cfg.formData.get('target_language')).toBe('de')
    expect(cfg.formData.get('source_language')).toBe('auto')
    expect(cfg.formData.get('useCache')).toBe('true')
    expect(cfg.formData.get('template')).toBe('Besprechung')
    expect(cfg.formData.get('callback_url')).toBe('https://app/cb')
  })

  it('builds video request with callback', () => {
    const job = {
      jobId: 'job3',
      jobSecretHash: 'hash',
      job_type: 'video',
      operation: 'transcribe',
      worker: 'secretary',
      status: 'queued',
      libraryId: 'lib1',
      userEmail: 'u@example.com',
      correlation: {
        jobId: 'job3',
        libraryId: 'lib1',
        source: { mediaType: 'video', name: 'v.mp4', itemId: 'it3', parentId: 'p1' },
        options: { targetLanguage: 'de', sourceLanguage: 'auto', useCache: false },
      },
      parameters: { template: 'Besprechung' },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const

    const cfg = prepareSecretaryRequest(job as any, createFile('v.mp4', 'video/mp4'), 'https://app/cb', 'secret')
    expect(cfg.url).toContain('/video/process')
    expect(cfg.formData.get('target_language')).toBe('de')
    expect(cfg.formData.get('useCache')).toBe('false')
    expect(cfg.formData.get('callback_url')).toBe('https://app/cb')
  })
})


