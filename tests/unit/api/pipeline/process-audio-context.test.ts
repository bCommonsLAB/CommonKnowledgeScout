import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * P3a: Der Unified-Pipeline-Endpunkt reicht die Audio-Kontext-Felder
 * (speakerMode, audioPrompt, audioKeywords) als correlation.options an den
 * Job durch — nur fuer Audio-Quellen, nur was der Client explizit gesetzt hat.
 * Clerk, Repository, Library-Service, Event-Bus und Worker-Trigger sind gemockt.
 */

const created: Array<Record<string, unknown>> = []

vi.mock('@clerk/nextjs/server', () => ({
  getAuth: () => ({ userId: 'user-1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'user@example.com' }] }),
}))

vi.mock('@/lib/events/job-event-bus', () => ({
  getJobEventBus: () => ({ emitUpdate: vi.fn() }),
}))

vi.mock('@/lib/services/library-service', () => ({
  LibraryService: {
    getInstance: () => ({ getLibrary: async () => ({ id: 'lib-1', config: {} }) }),
  },
}))

vi.mock('@/lib/external-jobs-repository', () => {
  class ExternalJobsRepository {
    hashSecret() {
      return 'hash'
    }
    async create(job: Record<string, unknown>) {
      created.push(job)
      return undefined
    }
  }
  return { ExternalJobsRepository }
})

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

interface JobShape {
  correlation: { options: Record<string, unknown> }
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/pipeline/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function audioItem() {
  return { fileId: 'item-1', parentId: 'parent-1', name: 'diskussion.m4a', mimeType: 'audio/mp4' }
}

const baseConfig = {
  phases: { extract: true, template: false, ingest: false },
  policies: { extract: 'force', metadata: 'ignore', ingest: 'ignore' },
  targetLanguage: 'de',
}

async function post(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/pipeline/process/route')
  // Der Handler erwartet NextRequest; fuer Body und Header reicht ein Request.
  return POST(buildRequest(body) as unknown as Parameters<typeof POST>[0])
}

function optionsOfFirstJob(): Record<string, unknown> {
  expect(created).toHaveLength(1)
  return (created[0] as unknown as JobShape).correlation.options
}

describe('POST /api/pipeline/process — Audio-Kontext (P3a)', () => {
  beforeEach(() => {
    created.length = 0
    // Worker-Trigger (best-effort) nicht wirklich aufrufen
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  })

  it('legt speakerMode, audioPrompt und audioKeywords als Job-Optionen ab', async () => {
    const res = await post({
      libraryId: 'lib-1',
      item: audioItem(),
      config: {
        ...baseConfig,
        speakerMode: true,
        audioPrompt: '  Journalistenschulung Armut, Diskussion  ',
        audioKeywords: ['Caritas', ' Pastoralzentrum ', ''],
      },
    })
    expect(res.status).toBe(200)
    const options = optionsOfFirstJob()
    expect(options.speakerMode).toBe(true)
    expect(options.audioPrompt).toBe('Journalistenschulung Armut, Diskussion')
    expect(options.audioKeywords).toEqual(['Caritas', 'Pastoralzentrum'])
    expect(options.targetLanguage).toBe('de')
  })

  it('ohne Felder im Request bleiben die Optionen weg (Server entscheidet ueber Library-Feld)', async () => {
    const res = await post({ libraryId: 'lib-1', item: audioItem(), config: baseConfig })
    expect(res.status).toBe(200)
    const options = optionsOfFirstJob()
    expect(options).not.toHaveProperty('speakerMode')
    expect(options).not.toHaveProperty('audioPrompt')
    expect(options).not.toHaveProperty('audioKeywords')
  })

  it('speakerMode=false wird explizit abgelegt (Uebersteuerung der Library-Voreinstellung)', async () => {
    await post({ libraryId: 'lib-1', item: audioItem(), config: { ...baseConfig, speakerMode: false } })
    expect(optionsOfFirstJob().speakerMode).toBe(false)
  })

  it('haengt die Audio-Optionen NICHT an Nicht-Audio-Jobs (PDF)', async () => {
    await post({
      libraryId: 'lib-1',
      item: { fileId: 'item-2', parentId: 'parent-1', name: 'folien.pdf', mimeType: 'application/pdf' },
      config: { ...baseConfig, speakerMode: true, audioPrompt: 'x' },
    })
    const options = optionsOfFirstJob()
    expect(options).not.toHaveProperty('speakerMode')
    expect(options).not.toHaveProperty('audioPrompt')
  })

  it('falscher Typ ist ein Client-Fehler (400), kein stilles Weglassen', async () => {
    const res = await post({
      libraryId: 'lib-1',
      item: audioItem(),
      config: { ...baseConfig, speakerMode: 'ja' },
    })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toContain('speakerMode')
    expect(created).toHaveLength(0)
  })
})
