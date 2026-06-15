/**
 * Tests des Wartekorb-Client-Service (U4.1). Mockt fetch und pinnt: Erfolg liefert
 * die Submission-ID, HTTP-Fehler werfen mit Server-Meldung (kein Silent-Fallback),
 * fehlende ID wirft.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { submitWizardCapture } from '@/lib/creation/wizard-submit'
import type { CaptureBody } from '@/lib/submissions/submission-capture'

const body: CaptureBody = {
  libraryId: 'lib-1',
  wizardId: 'event-creation-de',
  docType: 'event',
  detailViewType: 'session',
  markdownBody: '## Story',
  metadata: { title: 'Mein Event' },
}

afterEach(() => vi.restoreAllMocks())

function mockFetch(status: number, payload: unknown): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as unknown as typeof fetch
}

describe('submitWizardCapture', () => {
  it('liefert bei Erfolg die Submission-ID', async () => {
    mockFetch(201, { submission: { id: 'sub-123' } })
    await expect(submitWizardCapture(body)).resolves.toEqual({ id: 'sub-123' })
  })

  it('schickt JSON an POST /api/submissions', async () => {
    mockFetch(201, { submission: { id: 'sub-1' } })
    await submitWizardCapture(body)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('/api/submissions')
    expect(call[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse((call[1] as { body: string }).body)).toEqual(body)
  })

  it('wirft mit Server-Meldung bei HTTP-Fehler', async () => {
    mockFetch(403, { error: 'Keine Berechtigung zum Erfassen' })
    await expect(submitWizardCapture(body)).rejects.toThrow('Keine Berechtigung zum Erfassen')
  })

  it('wirft mit HTTP-Status, wenn keine Fehlermeldung kommt', async () => {
    mockFetch(500, {})
    await expect(submitWizardCapture(body)).rejects.toThrow('HTTP 500')
  })

  it('wirft, wenn die Antwort keine id enthält', async () => {
    mockFetch(201, { submission: {} })
    await expect(submitWizardCapture(body)).rejects.toThrow(/id fehlt/)
  })
})
