/**
 * @fileoverview Unit-Tests: Der Text-Feed blockiert den Aufrufer nicht mehr.
 *
 * Befund 27.08.2026 (Serverlog): `enqueueTemplateOnTextJob` wartete auf den
 * Selbst-Aufruf, der den GANZEN Job rechnet — 35,5 s je Datei. Ein Stapel von
 * sechs Quellen lief 3,6 Minuten und riss das 60-Sekunden-Limit der
 * MCP-Bruecke, obwohl der Job-Worker sechs Jobs parallel fahren kann.
 *
 * Vertrag seither: sofort zurueck mit `jobId`; ein gescheiterter Feed macht
 * den Job sichtbar `failed`, statt ihn still `queued` liegen zu lassen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const setStatus = vi.fn().mockResolvedValue(true)
const create = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    create = create
    setStatus = setStatus
    hashSecret = (secret: string) => `hash-${secret.slice(0, 4)}`
  },
}))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))

import { enqueueTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'

const ARGS = {
  libraryId: 'lib-1',
  userEmail: 'peter@example.org',
  source: { itemId: 'src-1', parentId: 'folder-1', name: 'Climaclub.m4a' },
  template: 'standard-meeting',
  extractedText: 'Ein Transkript.',
}

beforeEach(() => {
  create.mockClear()
  setStatus.mockClear()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('enqueueTemplateOnTextJob', () => {
  it('kehrt sofort zurueck, auch wenn der Feed lange rechnet', async () => {
    // Der Feed antwortet erst nach 5 s — der Aufrufer darf darauf NICHT warten.
    let aufgeloest: (() => void) | null = null
    const haengenderFetch = vi.fn(
      () => new Promise<Response>((f) => { aufgeloest = () => f(new Response('{}', { status: 200 })) }),
    )
    vi.stubGlobal('fetch', haengenderFetch)

    const ergebnis = await Promise.race([
      enqueueTemplateOnTextJob(ARGS),
      new Promise((_, ab) => setTimeout(() => ab(new Error('hat gewartet')), 1000)),
    ])

    expect((ergebnis as { jobId: string }).jobId).toBeTruthy()
    expect(create).toHaveBeenCalledTimes(1)
    expect(haengenderFetch).toHaveBeenCalledTimes(1)
    aufgeloest?.()
  })

  it('setzt den Job auf failed, wenn der Feed scheitert — nichts bleibt still queued', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('kaputt', { status: 500 })))

    const { jobId } = await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(setStatus).toHaveBeenCalled())

    expect(setStatus).toHaveBeenCalledWith(
      jobId,
      'failed',
      expect.objectContaining({ error: expect.objectContaining({ code: 'text_feed_failed' }) }),
    )
  })

  it('meldet auch einen nicht zustellbaren Feed (Netzwerkfehler)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const { jobId } = await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(setStatus).toHaveBeenCalled())

    expect(setStatus).toHaveBeenCalledWith(
      jobId,
      'failed',
      expect.objectContaining({ error: expect.objectContaining({ message: expect.stringContaining('nicht zustellbar') }) }),
    )
  })

  it('lehnt leeren Text ab, bevor ein Job entsteht', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(enqueueTemplateOnTextJob({ ...ARGS, extractedText: '   ' })).rejects.toThrow(/leer/)
    expect(create).not.toHaveBeenCalled()
  })
})
