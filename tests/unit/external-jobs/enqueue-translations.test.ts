/**
 * @fileoverview Unit-Tests fuer enqueue-translations Helper.
 *
 * Diese Tests pruefen die Form (Shape) der erzeugten External-Job-Objekte.
 * Der Worker-Dispatcher in `app/api/external/jobs/[jobId]/start/route.ts`
 * verzweigt anhand von `job_type === 'translation'` und
 * `correlation.options.phase === 'phase-translations'` in die Translation-
 * Phase – jedes Drift in dieser Vertragsschicht wuerde dazu fuehren, dass
 * Jobs entweder gar nicht oder durch die falsche Phase verarbeitet werden.
 *
 * Die `ExternalJobsRepository.create`-Methode wird gemockt, damit kein
 * echter Mongo-Zugriff stattfindet.
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { ExternalJob } from '@/types/external-job'

// Mock muss VOR dem Import stehen, das Modul wird beim Import geladen.
const createMock = vi.fn(async (_job: ExternalJob) => undefined)
vi.mock('@/lib/external-jobs-repository', () => {
  return {
    ExternalJobsRepository: class {
      // Hash-Funktion ist nicht relevant fuer den Job-Shape; deterministisch.
      hashSecret(secret: string): string {
        return `hash:${secret.length}`
      }
      async create(job: ExternalJob): Promise<void> {
        await createMock(job)
      }
    },
  }
})

import {
  enqueueTranslationJob,
  enqueueTranslationJobsForLocales,
} from '@/lib/external-jobs/enqueue-translations'

describe('enqueueTranslationJob', () => {
  beforeEach(() => {
    createMock.mockClear()
  })

  test('erzeugt Job mit korrektem Vertragsformat fuer Worker-Dispatcher', async () => {
    const result = await enqueueTranslationJob({
      libraryId: 'lib-1',
      fileId: 'file-42',
      sourceLocale: 'de',
      targetLocale: 'en',
      detailViewType: 'book',
      userEmail: 'author@example.com',
    })

    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/)
    expect(typeof result.jobSecret).toBe('string')
    expect(createMock).toHaveBeenCalledTimes(1)

    const job = createMock.mock.calls[0][0]
    // Vertrag mit Worker-Dispatcher (start/route.ts):
    expect(job.job_type).toBe('translation')
    expect(job.operation).toBe('translate')
    expect(job.worker).toBe('secretary')
    expect(job.status).toBe('queued')
    expect(job.libraryId).toBe('lib-1')
    expect(job.userEmail).toBe('author@example.com')

    // Worker phase-translations liest correlation.source.itemId als fileId:
    expect(job.correlation?.source?.itemId).toBe('file-42')
    expect(job.correlation?.options?.phase).toBe('phase-translations')
    expect(job.correlation?.options?.targetLocale).toBe('en')
    expect(job.correlation?.options?.sourceLocale).toBe('de')
    expect(job.correlation?.options?.detailViewType).toBe('book')
    expect(job.correlation?.options?.force).toBe(false)

    // Initialer Step muss "phase-translations" heissen, sonst kann der Worker
    // keine Step-Updates setzen.
    expect(job.steps?.[0]?.name).toBe('phase-translations')
    expect(job.steps?.[0]?.status).toBe('pending')
  })

  test('reicht das force-Flag durch (fuer Re-Translate-Button)', async () => {
    await enqueueTranslationJob({
      libraryId: 'lib-1',
      fileId: 'file-1',
      sourceLocale: 'de',
      targetLocale: 'en',
      userEmail: 'u@example.com',
      force: true,
    })
    const job = createMock.mock.calls[0][0]
    expect(job.correlation?.options?.force).toBe(true)
    expect(job.parameters?.force).toBe(true)
  })
})

describe('enqueueTranslationJobsForLocales', () => {
  beforeEach(() => {
    createMock.mockClear()
  })

  test('erzeugt einen Job pro Ziel-Locale und mappt locale -> jobId', async () => {
    const out = await enqueueTranslationJobsForLocales(
      {
        libraryId: 'lib-1',
        fileId: 'file-1',
        sourceLocale: 'de',
        userEmail: 'u@example.com',
      },
      ['en', 'fr', 'it'],
    )
    expect(Object.keys(out).sort()).toEqual(['en', 'fr', 'it'])
    expect(createMock).toHaveBeenCalledTimes(3)
    const targets = createMock.mock.calls.map(
      (c) => c[0].correlation?.options?.targetLocale,
    )
    expect(targets.sort()).toEqual(['en', 'fr', 'it'])
  })

  test('leere Locale-Liste erzeugt keine Jobs', async () => {
    const out = await enqueueTranslationJobsForLocales(
      {
        libraryId: 'lib-1',
        fileId: 'file-1',
        sourceLocale: 'de',
        userEmail: 'u@example.com',
      },
      [],
    )
    expect(out).toEqual({})
    expect(createMock).not.toHaveBeenCalled()
  })
})
