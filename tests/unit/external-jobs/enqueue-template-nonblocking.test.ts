/**
 * @fileoverview Unit-Tests: Der Text-Feed blockiert nicht und bilanziert ehrlich.
 *
 * Befund 27.08.2026 (Serverlog): `enqueueTemplateOnTextJob` wartete auf den
 * Selbst-Aufruf, der den GANZEN Job rechnet — 35,5 s je Datei. Ein Stapel von
 * sechs Quellen lief 3,6 Minuten und riss das 60-Sekunden-Limit der
 * MCP-Bruecke, obwohl der Job-Worker sechs Jobs parallel fahren kann.
 *
 * Befund 11.10.2026 (Welle I2): Der Feed setzte bedingungslos `failed` —
 * auch ueber einen Job, dessen Ingest fertig war. Vertrag seither: sofort
 * zurueck mit `jobId`; der Job ist ab Anlage `running` (nicht claimbar);
 * `failed` nur, wenn die Route den Job nie angefasst hat; Zeitablauf und
 * spaete Fehler sind Trace-Ereignisse.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue(undefined),
  setFailedIfUntouched: vi.fn().mockResolvedValue(true),
  traceAddEvent: vi.fn().mockResolvedValue(undefined),
  sende: vi.fn(),
}))

vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    create = mocks.create
    setFailedIfUntouched = mocks.setFailedIfUntouched
    traceAddEvent = mocks.traceAddEvent
    hashSecret = (secret: string) => `hash-${secret.slice(0, 4)}`
  },
}))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/lib/external-jobs/text-feed-transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/external-jobs/text-feed-transport')>()),
  sendeTextFeed: mocks.sende,
}))

import { enqueueTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { TextFeedZeitablauf } from '@/lib/external-jobs/text-feed-transport'

const ARGS = {
  libraryId: 'lib-1',
  userEmail: 'peter@example.org',
  source: { itemId: 'src-1', parentId: 'folder-1', name: 'Climaclub.m4a' },
  template: 'standard-meeting',
  ingest: false,
  extractedText: 'Ein Transkript.',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setFailedIfUntouched.mockResolvedValue(true)
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

describe('enqueueTemplateOnTextJob', () => {
  it('kehrt sofort zurueck, auch wenn der Feed lange rechnet', async () => {
    let aufgeloest: (() => void) | null = null
    mocks.sende.mockImplementation(
      () => new Promise((f) => { aufgeloest = () => f({ ok: true, status: 200, text: '{}' }) }),
    )

    const ergebnis = await Promise.race([
      enqueueTemplateOnTextJob(ARGS),
      new Promise((_, ab) => setTimeout(() => ab(new Error('hat gewartet')), 1000)),
    ])

    expect((ergebnis as { jobId: string }).jobId).toBeTruthy()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.sende).toHaveBeenCalledTimes(1)
    aufgeloest?.()
  })

  it('legt den Job als running an — der Worker darf ihn waehrend des Feeds nicht claimen', async () => {
    mocks.sende.mockResolvedValue({ ok: true, status: 200, text: '{}' })
    await enqueueTemplateOnTextJob(ARGS)
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ status: 'running', job_type: 'text' })
  })

  it('reicht die Zeitgrenze oberhalb der Template-Grenze an den Transport', async () => {
    process.env.EXTERNAL_TEMPLATE_TIMEOUT_MS = '600000'
    mocks.sende.mockResolvedValue({ ok: true, status: 200, text: '{}' })
    await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(mocks.sende).toHaveBeenCalled())
    const { zeitgrenzeMs } = mocks.sende.mock.calls[0][0] as { zeitgrenzeMs: number }
    expect(zeitgrenzeMs).toBeGreaterThan(600000)
    delete process.env.EXTERNAL_TEMPLATE_TIMEOUT_MS
  })

  it('setzt failed nur bedingt, wenn der Feed mit HTTP-Fehler scheitert', async () => {
    mocks.sende.mockResolvedValue({ ok: false, status: 500, text: 'kaputt' })

    const { jobId } = await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(mocks.setFailedIfUntouched).toHaveBeenCalled())

    expect(mocks.setFailedIfUntouched).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({ code: 'text_feed_failed', message: expect.stringContaining('HTTP 500') }),
    )
  })

  it('meldet auch einen nicht zustellbaren Feed (Netzwerkfehler) — bedingt', async () => {
    mocks.sende.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const { jobId } = await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(mocks.setFailedIfUntouched).toHaveBeenCalled())

    expect(mocks.setFailedIfUntouched).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({ message: expect.stringContaining('nicht zustellbar') }),
    )
  })

  it('laesst den Status der Route, wenn sie den Job schon in Arbeit hatte (Ingest fertig)', async () => {
    mocks.sende.mockRejectedValue(new Error('fetch failed'))
    mocks.setFailedIfUntouched.mockResolvedValue(false)

    const { jobId } = await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(mocks.traceAddEvent).toHaveBeenCalled())

    expect(mocks.traceAddEvent).toHaveBeenCalledWith(jobId, expect.objectContaining({ name: 'text_feed_fehler_nach_arbeit' }))
  })

  it('vermerkt einen Zeitablauf als Ereignis mit Deutung, nie als failed', async () => {
    mocks.sende.mockRejectedValue(new TextFeedZeitablauf(1_200_000))

    const { jobId } = await enqueueTemplateOnTextJob(ARGS)
    await vi.waitFor(() => expect(mocks.traceAddEvent).toHaveBeenCalled())

    expect(mocks.setFailedIfUntouched).not.toHaveBeenCalled()
    expect(mocks.traceAddEvent).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({ name: 'text_feed_timeout', message: expect.stringContaining('job_status') }),
    )
  })

  it('lehnt leeren Text ab, bevor ein Job entsteht', async () => {
    await expect(enqueueTemplateOnTextJob({ ...ARGS, extractedText: '   ' })).rejects.toThrow(/leer/)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
