import { describe, expect, it } from 'vitest'
import { wendeErsetzungenAufSegmenteAn } from '@/lib/transkript-verlaesslichkeit/segmente-korrektur'
import type { TranscriptSegment } from '@/lib/transkript-verlaesslichkeit/segmente'

function seg(text: string, start = 0): TranscriptSegment {
  return {
    start, end: start + 5, text, speaker: null, avgLogprob: null, minLogprob: -1.5, compressionRatio: null, noSpeechProb: null,
    qualitySource: 'logprobs', language: null, languages: [], textLanguage: 'de', textLanguageProb: null, timeSource: 'estimated',
  }
}

describe('wendeErsetzungenAufSegmenteAn', () => {
  it('ersetzt im ersten passenden Satz; Werte und Zeiten bleiben', () => {
    const r = wendeErsetzungenAufSegmenteAn([seg('Die Figur, der Radio ist eine andere.', 572), seg('Danke.')], [
      { alt: 'Die Figur, der Radio ist eine andere.', neu: 'Die Figur im Radio ist eine andere.' },
    ])
    expect(r.angewendet).toBe(1)
    expect(r.segments[0]).toMatchObject({ text: 'Die Figur im Radio ist eine andere.', start: 572, minLogprob: -1.5 })
  })

  it('alle: jedes Vorkommen in allen Saetzen', () => {
    const r = wendeErsetzungenAufSegmenteAn([seg('Frau Britzko sagt.'), seg('Danke, Frau Britzko.')], [{ alt: 'Britzko', neu: 'Britsko', alle: true }])
    expect(r.segments.map((s) => s.text)).toEqual(['Frau Britsko sagt.', 'Danke, Frau Britsko.'])
  })

  it('meldet, was in keinem einzelnen Satz steht (z. B. ueber eine Satzgrenze)', () => {
    const r = wendeErsetzungenAufSegmenteAn([seg('Eins.'), seg('Zwei.')], [{ alt: 'Eins. Zwei.', neu: 'Eins, zwei.' }])
    expect(r).toMatchObject({ angewendet: 0, nichtGefunden: ['Eins. Zwei.'] })
  })
})
