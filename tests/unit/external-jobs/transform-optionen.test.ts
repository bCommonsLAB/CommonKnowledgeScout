/**
 * Welle B — P6-Optionen in den Job-Bauern der Bruecke: nur explizite Booleans,
 * Audio-Kontext nur bei Audio, Video mit Sprecher-Option ist ein Fehler.
 */
import { describe, it, expect } from 'vitest'
import { transformParameter } from '@/lib/external-jobs/transform-optionen'
import { buildSourceTranscribeJob, buildTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { buildSourceMarkdownJob } from '@/lib/external-jobs/enqueue-markdown-job'

const BASE = { jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', source: { itemId: 's', parentId: 'p', name: 'Rede.m4a' } }

describe('transformParameter', () => {
  it('reicht nur explizite Booleans durch', () => {
    expect(transformParameter({ slidesAsTable: false, appendixInSearch: true })).toEqual({ slidesAsTable: false, appendixInSearch: true })
    expect(transformParameter({ slidesAsTable: undefined })).toEqual({})
    expect(transformParameter(undefined)).toEqual({})
  })
})

describe('Job-Bauer mit Optionen', () => {
  it('legt den Audio-Kontext in die Correlation-Optionen und P6 in die Parameter', () => {
    const job = buildSourceTranscribeJob({ ...BASE, mediaType: 'audio', template: 't', audioContext: { speakerMode: false, audioPrompt: 'Thema' }, optionen: { appendixInSearch: false } })
    expect(job.correlation.options).toMatchObject({ targetLanguage: 'de', speakerMode: false, audioPrompt: 'Thema' })
    expect(job.parameters).toMatchObject({ template: 't', appendixInSearch: false })
    expect(job.parameters).not.toHaveProperty('slidesAsTable')
  })

  it('weist Audio-Kontext bei Video ab statt ihn still zu verlieren', () => {
    expect(() => buildSourceTranscribeJob({ ...BASE, source: { ...BASE.source, name: 'Film.mp4' }, mediaType: 'video', audioContext: { speakerMode: true } }))
      .toThrow(/nur fuer Audio/)
    expect(buildSourceTranscribeJob({ ...BASE, mediaType: 'video', audioContext: {} }).correlation.options).not.toHaveProperty('speakerMode')
  })

  it('Template-auf-Text und Markdown-Jobs tragen P6 nur bei expliziten Werten', () => {
    expect(buildTemplateOnTextJob({ ...BASE, template: 't', optionen: { slidesAsTable: false } }).parameters).toMatchObject({ slidesAsTable: false })
    expect(buildTemplateOnTextJob({ ...BASE, template: 't' }).parameters).not.toHaveProperty('slidesAsTable')
    expect(buildSourceMarkdownJob({ ...BASE, template: 't', optionen: { appendixInSearch: true } }).parameters).toMatchObject({ appendixInSearch: true })
  })
})
