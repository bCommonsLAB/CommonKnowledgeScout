/**
 * Meistgestellte Fragen aus dem Fragen-Log (09.11.2026): Gruppierung nach
 * Normalform, Themenuebersicht und Leeres fallen weg, Reihung nach Zaehler.
 */
import { describe, it, expect } from 'vitest'
import { STORY_TOC_QUESTION } from '@ks/contracts'
import { normalisiereFrage, zaehleFragen } from '@/lib/db/queries-popular'

describe('zaehleFragen', () => {
  it('gruppiert Schreibvarianten, zaehlt und reiht absteigend', () => {
    const ergebnis = zaehleFragen(
      [
        { question: 'Which talks are in English?' },
        { question: 'which talks are in english' },
        { question: 'Which  talks are in English ?' },
        { question: 'Where do I find the rooms?' },
        { question: 'Where do I find the rooms?' },
        { question: 'Who speaks about the CRA?' },
      ],
      2,
    )
    expect(ergebnis).toEqual([
      { question: 'Which talks are in English?', count: 3 },
      { question: 'Where do I find the rooms?', count: 2 },
    ])
  })

  it('laesst Themenuebersicht (toc, neu und alt) und leere Zeilen weg', () => {
    const ergebnis = zaehleFragen(
      [
        { question: STORY_TOC_QUESTION },
        { question: 'Irgendwas', cacheParams: { queryType: 'toc' } },
        { question: 'Irgendwas anderes', queryType: 'toc' },
        { question: '   ' },
        { question: 'Echte Frage?', cacheParams: { queryType: 'question' } },
      ],
      5,
    )
    expect(ergebnis).toEqual([{ question: 'Echte Frage?', count: 1 }])
  })

  it('normalisiert klein, Leerraum und Satzzeichen am Ende', () => {
    expect(normalisiereFrage('  Wie  geht   das?!  ')).toBe('wie geht das')
    expect(normalisiereFrage('Was ist neu…')).toBe('was ist neu')
  })
})
