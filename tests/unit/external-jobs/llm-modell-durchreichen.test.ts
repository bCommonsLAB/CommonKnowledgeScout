/**
 * Welle ST8 — das LLM-Modell muss bis in die Job-Parameter durchkommen.
 *
 * Live-Befund 28.08.2026: Der Secretary war auf
 * `deepseek/deepseek-v4-flash-latest` konfiguriert — eine Modell-Id, die es
 * bei OpenRouter nicht gibt. Jede Transformation starb nach ~100 ms mit
 * HTTP 400, OHNE dass ein Token floss.
 *
 * Warum es aus der Werkbank trotzdem lief: Die gibt ein Modell mit
 * (`google/gemini-2.5-flash`, 12,3 s, 8.374 Tokens, erfolgreich). Die
 * MCP-Bruecke gab keines mit und fiel damit still auf den kaputten Default
 * eines fremden Dienstes zurueck.
 */
import { describe, expect, it } from 'vitest'
import { buildSourceTranscribeJob, buildTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'

const BASIS = {
  jobId: 'j1',
  jobSecretHash: 'h1',
  libraryId: 'lib',
  userEmail: 'a@b.c',
  source: { name: 'Anlage A1.pdf', itemId: 'i1', parentId: 'p1' },
}

describe('buildSourceTranscribeJob', () => {
  it('reicht llmModel in die Job-Parameter durch', () => {
    const job = buildSourceTranscribeJob({
      ...BASIS, mediaType: 'audio', template: 'standard-meeting',
      llmModel: 'google/gemini-2.5-flash',
    })
    expect(job.parameters?.llmModel).toBe('google/gemini-2.5-flash')
  })

  it('laesst das Feld weg, wenn keines angegeben ist', () => {
    const job = buildSourceTranscribeJob({ ...BASIS, mediaType: 'audio', template: 'standard-meeting' })
    expect('llmModel' in (job.parameters ?? {})).toBe(false)
  })

  it('behandelt Leerraum wie „nicht angegeben"', () => {
    const job = buildSourceTranscribeJob({ ...BASIS, mediaType: 'audio', template: 't', llmModel: '   ' })
    expect('llmModel' in (job.parameters ?? {})).toBe(false)
  })
})

describe('buildTemplateOnTextJob', () => {
  it('reicht llmModel durch — das ist der Weg, den transformation_starten nimmt', () => {
    const job = buildTemplateOnTextJob({
      ...BASIS, template: 'meeting_analyse-de', llmModel: 'google/gemini-2.5-flash',
    })
    expect(job.parameters?.llmModel).toBe('google/gemini-2.5-flash')
    expect(job.parameters?.template).toBe('meeting_analyse-de')
  })

  it('laesst das Feld weg, wenn keines angegeben ist', () => {
    const job = buildTemplateOnTextJob({ ...BASIS, template: 'meeting_analyse-de' })
    expect('llmModel' in (job.parameters ?? {})).toBe(false)
  })
})
