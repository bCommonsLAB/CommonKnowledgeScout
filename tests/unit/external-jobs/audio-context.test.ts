import { describe, expect, it } from 'vitest'
import { resolveAudioJobContext } from '@/lib/external-jobs/audio-context'
import type { ExternalJob } from '@/types/external-job'
import type { Library } from '@/types/library'

function job(options: Record<string, unknown>): ExternalJob {
  const now = new Date()
  return {
    jobId: 'job-1', jobSecretHash: 'h', job_type: 'audio', operation: 'transcribe', worker: 'secretary',
    status: 'queued', libraryId: 'lib-1', userEmail: 'u@example.com',
    correlation: { jobId: 'job-1', libraryId: 'lib-1', source: { mediaType: 'audio', name: 'a.m4a', itemId: 'it', parentId: 'p' }, options },
    createdAt: now, updatedAt: now,
  }
}

function library(config: Record<string, unknown>): Library {
  return { id: 'lib-1', label: 'L', type: 'local', path: '/x', isEnabled: true, config } as unknown as Library
}

describe('resolveAudioJobContext (P3a)', () => {
  it('ohne Job-Option und ohne Library-Feld: Sprecher-Modus aus, Quelle "default", kein Kontext', () => {
    const ctx = resolveAudioJobContext(job({}), undefined)
    expect(ctx).toEqual({ prompt: undefined, keywords: [], speakerMode: false, speakerModeSource: 'default' })
  })

  it('Library-Voreinstellung greift, wenn der Job nichts sagt', () => {
    const ctx = resolveAudioJobContext(job({}), library({ transcriptionSpeakerMode: true }))
    expect(ctx.speakerMode).toBe(true)
    expect(ctx.speakerModeSource).toBe('library')
  })

  it('Job-Option uebersteuert die Library-Voreinstellung (auch mit false)', () => {
    const ctx = resolveAudioJobContext(job({ speakerMode: false }), library({ transcriptionSpeakerMode: true }))
    expect(ctx.speakerMode).toBe(false)
    expect(ctx.speakerModeSource).toBe('job')
  })

  it('keywords = bekannte Namen der Library + Datei-Begriffe, dedupliziert, Reihenfolge erhalten', () => {
    const ctx = resolveAudioJobContext(
      job({ audioKeywords: ['Caritas', ' Aichner ', 'POW', 'caritas'], audioPrompt: '  Vortrag Armut  ' }),
      library({ extractionKnownNames: ['Peter Aichner', 'POW'] }),
    )
    expect(ctx.keywords).toEqual(['Peter Aichner', 'POW', 'Caritas', 'Aichner'])
    expect(ctx.prompt).toBe('Vortrag Armut')
  })

  it('ignoriert Nicht-Strings in Listen statt zu werfen (Typpruefung macht die Route)', () => {
    const ctx = resolveAudioJobContext(job({ audioKeywords: ['A', 3, null], audioPrompt: '' }), undefined)
    expect(ctx.keywords).toEqual(['A'])
    expect(ctx.prompt).toBeUndefined()
  })
})
