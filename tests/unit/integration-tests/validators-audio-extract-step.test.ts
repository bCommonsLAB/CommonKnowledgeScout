import { describe, expect, it, vi, beforeEach } from 'vitest'

import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

/**
 * Fokus: Audio-Jobs müssen in den Validatoren den Step `extract_audio` verwenden
 * (nicht hardcoded `extract_pdf`).
 *
 * Wir mocken das Repo und geben einen minimalen completed Job zurück.
 */

describe('integration-tests/validators (audio)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('validiert Extract-Step über job_type=audio → extract_audio', async () => {
    const fakeJob = {
      jobId: 'job-1',
      job_type: 'audio',
      status: 'completed',
      libraryId: 'lib-1',
      userEmail: 'u@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      correlation: {
        jobId: 'job-1',
        libraryId: 'lib-1',
        source: { itemId: 'file-1', parentId: 'root', name: 'audio.mp3', mimeType: 'audio/mpeg', mediaType: 'audio' },
        options: { targetLanguage: 'de' },
      },
      parameters: {
        phases: { template: false, ingest: false },
      },
      // Für completed: keine pending Steps (Global Contract)
      steps: [
        { name: 'extract_audio', status: 'completed', details: { skipped: false } },
        { name: 'transform_template', status: 'completed', details: { skipped: true, reason: 'phase_disabled' } },
        { name: 'store_shadow_twin', status: 'completed' },
        { name: 'ingest_rag', status: 'completed', details: { skipped: true, reason: 'phase_disabled' } },
      ],
      result: {
        savedItemId: buildMongoShadowTwinId({
          libraryId: 'lib-1',
          sourceId: 'file-1',
          kind: 'transcript',
          targetLanguage: 'de',
        }),
      },
    }

    vi.doMock('@/lib/external-jobs-repository', () => ({
      ExternalJobsRepository: class {
        async get(jobId: string) {
          return jobId === 'job-1' ? (fakeJob as any) : null
        }
      },
    }))

    vi.doMock('@/lib/services/library-service', () => ({
      LibraryService: {
        getInstance() {
          return {
            async getLibrary() {
              return { id: 'lib-1', config: {} }
            },
          }
        },
      },
    }))

    vi.doMock('@/lib/storage/server-provider', () => ({
      getServerProvider: async () => ({}),
    }))

    vi.doMock('@/lib/shadow-twin/store/shadow-twin-service', () => ({
      ShadowTwinService: class {
        async getMarkdown() {
          return { name: 'audio.de.md', markdown: 'hello world' }
        }
      },
    }))

    const { validateExternalJobForTestCase } = await import('@/lib/integration-tests/validators')

    const testCase = {
      id: 'audio_transcription.happy_path',
      target: 'audio',
      useCaseId: 'audio_transcription',
      scenarioId: 'happy_path',
      label: 'Audio – Happy Path',
      description: 'Unit-Test',
      category: 'usecase',
      phases: { extract: true, template: false, ingest: false },
      expected: { shouldComplete: true, expectShadowTwinExists: false, expectTranscriptNonEmpty: true, minTranscriptChars: 3 },
    } as any

    const res = await validateExternalJobForTestCase(testCase, 'job-1')

    expect(res.ok).toBe(true)
    expect(res.messages.some(m => m.message.includes('Step "extract_audio" hat erwarteten Status "completed"'))).toBe(true)
    expect(res.messages.some(m => m.message.includes('Step "extract_pdf"'))).toBe(false)
  })
})

