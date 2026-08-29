/**
 * Welle ST11 — `erzwingen` muss als `policies.extract: 'force'` im Job landen.
 *
 * Befund 29.08.2026 (Cowork, „24.09 KnowledgeScout"): Alt-Familien mit
 * Transformation OHNE Transkript verletzen die Gate-Annahme „Transformation
 * impliziert Transkript" (`gateExtractPdf`, includeSupersets). Das Gate
 * uebersprang die Transkription, der Job wurde completed und schrieb nichts.
 * Die Pipeline kann 'force' laengst (Gate wird ignoriert) — nur die Bruecke
 * setzte hart 'do'. Diese Tests halten den Durchstich fest.
 */
import { describe, expect, it } from 'vitest'
import { buildSourceTranscribeJob } from '@/lib/external-jobs/enqueue-secretary-job'

const BASIS = {
  jobId: 'j1',
  jobSecretHash: 'h1',
  libraryId: 'lib',
  userEmail: 'a@b.c',
  source: { name: 'Vortrag.mp4', itemId: 'i1', parentId: 'p1' },
}

interface MitPolicies {
  policies?: { extract?: string; metadata?: string; ingest?: string }
}

describe('buildSourceTranscribeJob — erzwingen', () => {
  it('setzt policies.extract auf force, wenn erzwingen=true', () => {
    const job = buildSourceTranscribeJob({
      ...BASIS, mediaType: 'video', template: 'standard-meeting', erzwingen: true,
    })
    expect((job.parameters as MitPolicies).policies?.extract).toBe('force')
  })

  it('bleibt ohne erzwingen bei do (Gate wird respektiert)', () => {
    const job = buildSourceTranscribeJob({ ...BASIS, mediaType: 'video', template: 'standard-meeting' })
    expect((job.parameters as MitPolicies).policies?.extract).toBe('do')
  })

  it('erzwingt auch im nur_transkript-Fall (ohne Template)', () => {
    const job = buildSourceTranscribeJob({ ...BASIS, mediaType: 'audio', erzwingen: true })
    const policies = (job.parameters as MitPolicies).policies
    expect(policies?.extract).toBe('force')
    // erzwingen aendert NUR die Extract-Policy — Template/Ingest bleiben aus.
    expect(policies?.metadata).toBe('ignore')
    expect(policies?.ingest).toBe('ignore')
  })
})
