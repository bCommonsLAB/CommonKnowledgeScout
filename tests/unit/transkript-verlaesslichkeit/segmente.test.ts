import { describe, expect, it } from 'vitest'
import { readTranscriptSegments } from '@/lib/transkript-verlaesslichkeit/segmente'

/** Antwortform des Secretary-Branchs transkript-verlaesslichkeit (09.10.2026). */
describe('readTranscriptSegments', () => {
  it('normalisiert die Werte je Satz (gpt-transcribe, geschaetzte Zeiten)', () => {
    const r = readTranscriptSegments({ data: {
      language: 'de', llm_model: 'gpt-transcribe',
      segments: [{
        segment_id: 0, start: 0, end: 12.5, text: ' Jährlich werden Schafe und Ziegen erhoben. ', speaker: null,
        avg_logprob: -0.01, min_logprob: -1.79, compression_ratio: 1.1, no_speech_prob: null, confidence: 0.99,
        quality_source: 'logprobs', languages: ['de', 'it'], text_language: 'de', text_language_prob: 0.93, time_source: 'estimated',
      }],
    } })
    expect(r).toEqual({
      dataLanguage: 'de', llmModel: 'gpt-transcribe', verworfen: 0, translatedChunks: null,
      segments: [{
        start: 0, end: 12.5, text: 'Jährlich werden Schafe und Ziegen erhoben.', speaker: null,
        avgLogprob: -0.01, minLogprob: -1.79, compressionRatio: 1.1, noSpeechProb: null, qualitySource: 'logprobs',
        language: null, languages: ['de', 'it'], textLanguage: 'de', textLanguageProb: 0.93, timeSource: 'estimated',
      }],
    })
  })

  it('alter Secretary ohne Werte: Segmente bleiben, alle Werte null (nicht als sicher gelesen)', () => {
    const r = readTranscriptSegments({ data: { transcription: { text: 'x', segments: [{ segment_id: 0, start: 0, end: 30, text: 'Hallo', confidence: 1 }] } } })
    expect(r.segments).toHaveLength(1)
    expect(r.segments[0]).toMatchObject({ avgLogprob: null, minLogprob: null, qualitySource: null, languages: [] })
  })

  it('verwirft Eintraege ohne Text oder Zeitmarken und zaehlt sie', () => {
    const r = readTranscriptSegments({ data: { segments: [{ start: 0, end: 1, text: '' }, { text: 'ohne Zeit' }, { start: 1, end: 2, text: 'ok' }] } })
    expect(r.segments.map((s) => s.text)).toEqual(['ok'])
    expect(r.verworfen).toBe(2)
  })

  it('ohne data: leer', () => {
    expect(readTranscriptSegments({ phase: 'completed' })).toEqual({ segments: [], translatedChunks: null, dataLanguage: null, llmModel: null, verworfen: 0 })
  })

  it('translated_chunks: Liste wird gelesen, fehlender Schluessel ist null (unbekannt), nicht leer', () => {
    const mit = readTranscriptSegments({ data: { segments: [], translated_chunks: [{ index: 2, start: 275.4, end: 553.6, source_language: 'it', target_language: 'de' }] } })
    expect(mit.translatedChunks).toEqual([{ index: 2, start: 275.4, end: 553.6, sourceLanguage: 'it', targetLanguage: 'de' }])
    expect(readTranscriptSegments({ data: { segments: [], translated_chunks: [] } }).translatedChunks).toEqual([])
    expect(readTranscriptSegments({ data: { segments: [] } }).translatedChunks).toBeNull()
  })
})
