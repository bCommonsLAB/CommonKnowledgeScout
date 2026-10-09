import { describe, expect, it } from 'vitest'
import { extractSecretaryAudioTranscript } from '@/lib/secretary/extract-audio-text'
describe('neue Secretary-Form', () => {
  it('normaler Weg: Segmente ohne Sprecher stoeren nicht, output_text gewinnt', () => {
    const r = extractSecretaryAudioTranscript({ data: {
      output_text: 'Ganzer Text.', language: 'de',
      segments: [
        { segment_id: 0, start: 0, end: 5, text: 'Ganzer', speaker: null, title: null, avg_logprob: -0.2, compression_ratio: 1.1, no_speech_prob: 0.01, confidence: 0.8, quality_source: 'whisper' },
        { segment_id: 1, start: 5, end: 9, text: 'Text.', speaker: null, title: null, avg_logprob: -1.6, compression_ratio: 2.7, no_speech_prob: 0.65, confidence: 0.2, quality_source: 'whisper' },
      ],
      transcription: { text: 'Ganzer Text.' },
    } })
    expect(r).toEqual({ text: 'Ganzer Text.', speakers: [] })
  })
  it('Sprecher-Weg: null-Werte je Segment aendern die Absaetze nicht', () => {
    const r = extractSecretaryAudioTranscript({ data: {
      output_text: 'x', speakers: ['Stück 1 Sprecher A'],
      segments: [{ speaker: 'Stück 1 Sprecher A', start: 0, end: 3, text: 'Hallo', avg_logprob: null, compression_ratio: null, no_speech_prob: null, confidence: null, quality_source: 'none' }],
    } })
    expect(r.text).toBe('**Stück 1 Sprecher A:** Hallo')
  })
})
