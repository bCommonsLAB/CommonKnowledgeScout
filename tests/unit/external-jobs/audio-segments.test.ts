import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/lib/repositories/transcript-segments-repo', () => ({ saveTranscriptSegments: h.save }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { persistAudioSegments } from '@/lib/external-jobs/audio-segments'
import type { ExternalJob } from '@/types/external-job'

function job(itemId: string | undefined): ExternalJob {
  const now = new Date()
  return {
    jobId: 'job-1', jobSecretHash: 'h', job_type: 'audio', operation: 'extract', worker: 'secretary',
    status: 'running', libraryId: 'lib-1', userEmail: 'u@example.com',
    correlation: { jobId: 'job-1', libraryId: 'lib-1', source: { mediaType: 'audio', name: 'a.m4a', itemId: itemId as string, parentId: 'p' }, options: { targetLanguage: 'de' } },
    createdAt: now, updatedAt: now,
  }
}

const body = { phase: 'completed', data: { language: 'de', segments: [
  { start: 0, end: 5, text: 'Eins.', min_logprob: -0.2, quality_source: 'logprobs' },
  { start: 5, end: 9, text: 'Zwei.', quality_source: 'none' },
] } }

describe('persistAudioSegments', () => {
  beforeEach(() => { h.save.mockReset() })

  it('speichert alle Segmente unter sourceId + Transkript-Sprache und meldet die Zahl mit Werten', async () => {
    h.save.mockResolvedValue(undefined)
    const log = vi.fn()
    const r = await persistAudioSegments({ job: job('src-1'), callbackBody: body, log })
    expect(r).toEqual({ gespeichert: true, anzahl: 2, mitWerten: 1 })
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'lib-1', sourceId: 'src-1', targetLanguage: 'de', jobId: 'job-1', dataLanguage: 'de' }))
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ phase: 'transcript_segments_saved', anzahl: 2, mitWerten: 1 }))
  })

  it('ohne Segmente wird trotzdem ersetzt (leere Liste) — kein alter Stand bleibt stehen', async () => {
    h.save.mockResolvedValue(undefined)
    const r = await persistAudioSegments({ job: job('src-1'), callbackBody: { data: { transcription: { text: 'x' } } }, log: vi.fn() })
    expect(r.gespeichert).toBe(true)
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ segments: [] }))
  })

  it('Speicherfehler laesst den Job weiterlaufen, steht aber laut im Trace', async () => {
    h.save.mockRejectedValue(new Error('Mongo weg'))
    const log = vi.fn()
    const r = await persistAudioSegments({ job: job('src-1'), callbackBody: body, log })
    expect(r.gespeichert).toBe(false)
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ phase: 'transcript_segments_failed', message: 'Segmente nicht gespeichert: Mongo weg' }))
  })

  it('Job ohne itemId: nichts gespeichert, Grund im Trace', async () => {
    const log = vi.fn()
    const r = await persistAudioSegments({ job: job(undefined), callbackBody: body, log })
    expect(r.gespeichert).toBe(false)
    expect(h.save).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ phase: 'transcript_segments_skipped' }))
  })
})
