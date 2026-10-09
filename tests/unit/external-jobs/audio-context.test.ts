import { describe, expect, it } from 'vitest'
import { readAudioContextOptions, resolveAudioJobContext } from '@/lib/external-jobs/audio-context'
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
    expect(ctx).toEqual({ prompt: undefined, keywords: [], speakerMode: false, speakerModeSource: 'default', languages: [], languagesSource: 'none' })
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

describe('readAudioContextOptions (P3a, gemeinsamer Leser beider Routen)', () => {
  it('leeres Body: keine Optionen', () => {
    expect(readAudioContextOptions({})).toEqual({ options: {} })
  })

  it('trimmt Prompt und Begriffe, laesst Leeres weg, nimmt speakerMode als Boolean', () => {
    const result = readAudioContextOptions({
      audioPrompt: '  Vortrag  ',
      audioKeywords: [' A ', '', 'B'],
      speakerMode: false,
    })
    expect(result).toEqual({ options: { audioPrompt: 'Vortrag', audioKeywords: ['A', 'B'], speakerMode: false } })
  })

  it('leerer Prompt und leere Liste erzeugen keine Option', () => {
    expect(readAudioContextOptions({ audioPrompt: '   ', audioKeywords: [] })).toEqual({ options: {} })
  })

  it('falsche Typen liefern einen Fehler statt stiller Korrektur', () => {
    expect(readAudioContextOptions({ speakerMode: 'ja' as unknown as boolean })).toEqual({ error: 'speakerMode muss ein Boolean sein' })
    expect(readAudioContextOptions({ audioKeywords: 'A' as unknown as string[] })).toEqual({ error: 'audioKeywords muss eine Liste von Strings sein' })
    expect(readAudioContextOptions({ audioPrompt: 1 as unknown as string })).toEqual({ error: 'audioPrompt muss ein String sein' })
  })
})

describe('Sprachen der Aufnahme', () => {
  it('Library-Voreinstellung greift, wenn der Job nichts sagt; Codes normalisiert', () => {
    const ctx = resolveAudioJobContext(job({}), library({ transcriptionLanguages: ['DE', 'it', 'de'] }))
    expect(ctx.languages).toEqual(['de', 'it'])
    expect(ctx.languagesSource).toBe('library')
  })

  it('Job-Option uebersteuert die Library-Voreinstellung', () => {
    const ctx = resolveAudioJobContext(job({ audioLanguages: ['it'] }), library({ transcriptionLanguages: ['de', 'it'] }))
    expect(ctx.languages).toEqual(['it'])
    expect(ctx.languagesSource).toBe('job')
  })

  it('readAudioContextOptions: gueltige Codes werden Job-Option, ungueltige sind ein Fehler statt still weg', () => {
    expect(readAudioContextOptions({ audioLanguages: [' de ', 'IT'] })).toEqual({ options: { audioLanguages: ['de', 'it'] } })
    const fehler = readAudioContextOptions({ audioLanguages: ['de', 'deutsch'] })
    expect('error' in fehler && fehler.error).toContain('deutsch')
    expect(readAudioContextOptions({ audioLanguages: 'de' as unknown as string[] })).toEqual({ error: 'audioLanguages muss eine Liste von Strings sein' })
  })
})
