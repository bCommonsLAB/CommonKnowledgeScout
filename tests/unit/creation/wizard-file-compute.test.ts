/**
 * Tests des Off-target Datei-Compute-Service (U5c). Pinnt den Vertrag:
 * Upload -> Inbox-Submission -> Analyse-Job -> Flowback -> Entwurf, inkl. harter
 * Fehler bei fehlender id/jobId, leerem Ergebnis und falschem Compute-Modus
 * (no-silent-fallbacks). fetch + waitForJob sind injiziert/gestubbt.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  assertInboxJobMode,
  computeFileMediaDraft,
  fetchSubmissionDraft,
  startSubmissionAnalysis,
  uploadFileMediaToInbox,
  type FileMediaCaptureFields,
} from '@/lib/creation/wizard-file-compute'

interface MockResponse {
  ok: boolean
  status: number
  body: unknown
}

function mockFetch(responses: MockResponse[]): ReturnType<typeof vi.fn> {
  const queue = [...responses]
  return vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('mockFetch: keine Antwort mehr in der Queue')
    return { ok: next.ok, status: next.status, json: async () => next.body } as Response
  })
}

const FIELDS: FileMediaCaptureFields = {
  libraryId: 'lib-1',
  wizardId: 'pdf-upload',
  docType: 'pdfanalyse',
  detailViewType: 'book',
}

const PDF = new File(['%PDF-1.7'], 'Quelle.pdf', { type: 'application/pdf' })

describe('assertInboxJobMode', () => {
  it('akzeptiert inbox-job', () => {
    expect(() => assertInboxJobMode('inbox-job')).not.toThrow()
  })
  it('wirft fuer text-sync (reiner Text gehoert nicht in die Datei-Pipeline)', () => {
    expect(() => assertInboxJobMode('text-sync')).toThrow(/inbox-job/)
  })
})

describe('uploadFileMediaToInbox', () => {
  it('postet multipart an /api/submissions und liefert die id', async () => {
    const fetchImpl = mockFetch([{ ok: true, status: 201, body: { submission: { id: 'sub-1' } } }])
    const id = await uploadFileMediaToInbox(PDF, FIELDS, fetchImpl)
    expect(id).toBe('sub-1')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/submissions')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('wirft mit Server-Meldung bei HTTP-Fehler', async () => {
    const fetchImpl = mockFetch([{ ok: false, status: 403, body: { error: 'Keine Berechtigung zum Erfassen' } }])
    await expect(uploadFileMediaToInbox(PDF, FIELDS, fetchImpl)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('wirft bei fehlenden Pflichtfeldern (kein Silent-Fallback)', async () => {
    const fetchImpl = mockFetch([])
    await expect(uploadFileMediaToInbox(PDF, { ...FIELDS, libraryId: ' ' }, fetchImpl)).rejects.toThrow(/libraryId/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('startSubmissionAnalysis', () => {
  it('liefert die jobId', async () => {
    const fetchImpl = mockFetch([{ ok: true, status: 202, body: { status: 'accepted', jobId: 'job-1' } }])
    expect(await startSubmissionAnalysis('sub-1', fetchImpl)).toBe('job-1')
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/submissions/sub-1/analyze')
  })

  it('wirft, wenn jobId fehlt', async () => {
    const fetchImpl = mockFetch([{ ok: true, status: 202, body: { status: 'accepted' } }])
    await expect(startSubmissionAnalysis('sub-1', fetchImpl)).rejects.toThrow(/jobId fehlt/)
  })

  it('ohne transcriptOnly: POST ohne Body (Standard = Transform)', async () => {
    const fetchImpl = mockFetch([{ ok: true, status: 202, body: { jobId: 'job-1' } }])
    await startSubmissionAnalysis('sub-1', fetchImpl)
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })

  it('5a transcriptOnly: POSTet Body { mode: "transcript" }', async () => {
    const fetchImpl = mockFetch([{ ok: true, status: 202, body: { jobId: 'job-1' } }])
    await startSubmissionAnalysis('sub-1', fetchImpl, { transcriptOnly: true })
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ mode: 'transcript' }))
  })
})

describe('fetchSubmissionDraft', () => {
  it('projiziert die Submission auf den Entwurf (markdownBody -> markdown)', async () => {
    const fetchImpl = mockFetch([
      { ok: true, status: 200, body: { submission: { metadata: { title: 'T' }, markdownBody: '## Body' } } },
    ])
    expect(await fetchSubmissionDraft('sub-1', fetchImpl)).toEqual({
      submissionId: 'sub-1',
      draft: { metadata: { title: 'T' }, markdown: '## Body' },
    })
  })

  it('wirft bei leerem Analyse-Ergebnis', async () => {
    const fetchImpl = mockFetch([{ ok: true, status: 200, body: { submission: { metadata: {}, markdownBody: '' } } }])
    await expect(fetchSubmissionDraft('sub-1', fetchImpl)).rejects.toThrow(/leer/)
  })
})

describe('computeFileMediaDraft — Orchestrierung', () => {
  it('Upload -> Analyse -> waitForJob(jobId) -> Flowback -> Entwurf', async () => {
    const fetchImpl = mockFetch([
      { ok: true, status: 201, body: { submission: { id: 'sub-1' } } },
      { ok: true, status: 202, body: { jobId: 'job-1' } },
      { ok: true, status: 200, body: { submission: { metadata: { title: 'T' }, markdownBody: '## Body' } } },
    ])
    const waitForJob = vi.fn(async () => undefined)
    const result = await computeFileMediaDraft({ file: PDF, fields: FIELDS, waitForJob, fetchImpl })

    expect(result).toEqual({ submissionId: 'sub-1', draft: { metadata: { title: 'T' }, markdown: '## Body' } })
    expect(waitForJob).toHaveBeenCalledWith('job-1')
    // Reihenfolge: erst Upload+Analyse, dann erst auf den Job warten.
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([
      '/api/submissions',
      '/api/submissions/sub-1/analyze',
      '/api/submissions/sub-1',
    ])
  })

  it('5a: reicht transcriptOnly an den Analyse-Start durch (mode im Body)', async () => {
    const fetchImpl = mockFetch([
      { ok: true, status: 201, body: { submission: { id: 'sub-1' } } },
      { ok: true, status: 202, body: { jobId: 'job-1' } },
      { ok: true, status: 200, body: { submission: { metadata: { title: 'T' }, markdownBody: '## Body' } } },
    ])
    const waitForJob = vi.fn(async () => undefined)
    await computeFileMediaDraft({ file: PDF, fields: FIELDS, waitForJob, fetchImpl, transcriptOnly: true })
    const analyzeInit = fetchImpl.mock.calls[1][1] as RequestInit
    expect(analyzeInit.body).toBe(JSON.stringify({ mode: 'transcript' }))
  })

  it('bricht ab, bevor gewartet wird, wenn die Analyse nicht startet', async () => {
    const fetchImpl = mockFetch([
      { ok: true, status: 201, body: { submission: { id: 'sub-1' } } },
      { ok: false, status: 422, body: { error: 'Keine analysierbare Quelle' } },
    ])
    const waitForJob = vi.fn(async () => undefined)
    await expect(computeFileMediaDraft({ file: PDF, fields: FIELDS, waitForJob, fetchImpl })).rejects.toThrow(
      /analysierbare Quelle/,
    )
    expect(waitForJob).not.toHaveBeenCalled()
  })
})
