import { describe, expect, it } from 'vitest'
import { bewerteSegmente, formatZeit } from '@/lib/transkript-verlaesslichkeit/befunde'
import type { TranscriptSegment } from '@/lib/transkript-verlaesslichkeit/segmente'

function seg(p: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    start: 0, end: 5, text: 'Satz.', speaker: null, avgLogprob: null, minLogprob: null, compressionRatio: null,
    noSpeechProb: null, qualitySource: 'logprobs', language: null, languages: [], textLanguage: null, textLanguageProb: null, timeSource: null,
    ...p,
  }
}

describe('bewerteSegmente', () => {
  it('ohne Werte: kein Befund, mitWerten 0 (keine Aussage, nicht „sicher")', () => {
    const b = bewerteSegmente([seg({})], [])
    expect(b.gelb).toBe(0)
    expect(b.mitWerten).toBe(0)
  })

  it('unsicheres Wort ab min_logprob unter -1', () => {
    const b = bewerteSegmente([seg({ minLogprob: -1.79 }), seg({ start: 5, end: 9, minLogprob: -0.4 })], [])
    expect(b.saetze.map((s) => s.befunde.map((x) => x.art))).toEqual([['unsicheres_wort'], []])
    expect(b.gelb).toBe(1)
  })

  it('Schleife, und Stille nur zusammen mit schlechtem avg_logprob (Whisper-Regel)', () => {
    const b = bewerteSegmente([
      seg({ compressionRatio: 2.7 }),
      seg({ noSpeechProb: 0.97, avgLogprob: -0.7 }),
      seg({ noSpeechProb: 0.9, avgLogprob: -1.3 }),
    ], [])
    expect(b.saetze[0].befunde.map((x) => x.art)).toEqual(['wiederholung'])
    expect(b.saetze[1].befunde).toEqual([])
    expect(b.saetze[2].befunde.map((x) => x.art)).toEqual(['unsicherer_abschnitt', 'vielleicht_erfunden'])
  })

  it('Sprachpruefung nur mit erlaubten Sprachen; fremde Sprache markiert', () => {
    const s = [seg({ textLanguage: 'sv' }), seg({ textLanguage: 'it' })]
    expect(bewerteSegmente(s, []).gelb).toBe(0)
    const b = bewerteSegmente(s, ['de', 'IT'])
    expect(b.sprachpruefung).toBe(true)
    expect(b.saetze.map((x) => x.befunde.map((y) => y.art))).toEqual([['fremde_sprache'], []])
  })

  it('vom Modell markierte unverstaendliche Stelle', () => {
    expect(bewerteSegmente([seg({ text: 'Und dann … ja.' })], []).saetze[0].befunde[0].art).toBe('unverstaendlich')
  })

  it('uebersetzte Stuecke markieren die Saetze im Zeitbereich; ohne Angabe ist die Uebersetzung unbekannt', () => {
    const s = [seg({ start: 0, end: 5 }), seg({ start: 280, end: 290 })]
    const b = bewerteSegmente(s, [], [{ index: 2, start: 275, end: 553, sourceLanguage: 'it', targetLanguage: 'de' }])
    expect(b.saetze.map((x) => x.befunde.map((y) => y.art))).toEqual([[], ['uebersetzt']])
    expect(b.uebersetzung).toBe(1)
    expect(bewerteSegmente(s, [], []).uebersetzung).toBe(0)
    expect(bewerteSegmente(s, []).uebersetzung).toBe('unbekannt')
  })

  it('Luecke ueber 10 s vor einem Satz', () => {
    const b = bewerteSegmente([seg({ start: 0, end: 5 }), seg({ start: 9, end: 12 }), seg({ start: 40, end: 44 })], [])
    expect(b.saetze.map((s) => s.lueckeDavor)).toEqual([null, null, 28])
    expect(b.luecken).toBe(1)
  })
})

describe('formatZeit', () => {
  it('mm:ss und h:mm:ss', () => {
    expect(formatZeit(572.4)).toBe('9:32')
    expect(formatZeit(3725)).toBe('1:02:05')
  })
})
