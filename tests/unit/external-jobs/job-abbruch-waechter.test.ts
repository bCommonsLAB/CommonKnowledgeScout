/**
 * @fileoverview Unit-Tests: Abbruch-Waechter (Befund 23.09.2026).
 *
 * Ein von Hand beendeter Job (`job_abbrechen` → status failed) darf keinen
 * Schreibschritt mehr ausfuehren; der Abbruchgrund bleibt in der Antwort.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/external-jobs-log-buffer', () => ({ bufferLog: vi.fn() }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { pruefeJobNichtAbgebrochen } from '@/lib/external-jobs/job-abbruch-waechter'

function repoMit(job: Record<string, unknown> | null) {
  return { get: vi.fn(async () => job) } as unknown as Parameters<typeof pruefeJobNichtAbgebrochen>[0]
}

describe('pruefeJobNichtAbgebrochen', () => {
  it('laufender Job: nicht abgebrochen', async () => {
    expect(await pruefeJobNichtAbgebrochen(repoMit({ status: 'running' }), 'j1', 'ingest_rag'))
      .toEqual({ abgebrochen: false })
  })

  it('von Hand beendeter Job: abgebrochen, Grund traegt Code und Meldung', async () => {
    const r = await pruefeJobNichtAbgebrochen(
      repoMit({ status: 'failed', error: { code: 'von_hand_abgebrochen', message: 'Falsche Vorlage' } }),
      'j1', 'transform_template',
    )
    expect(r.abgebrochen).toBe(true)
    if (r.abgebrochen) expect(r.grund).toMatch(/von_hand_abgebrochen.*Falsche Vorlage/)
  })

  it('verschwundener Job: abgebrochen', async () => {
    const r = await pruefeJobNichtAbgebrochen(repoMit(null), 'j1', 'abschluss')
    expect(r.abgebrochen).toBe(true)
  })
})
