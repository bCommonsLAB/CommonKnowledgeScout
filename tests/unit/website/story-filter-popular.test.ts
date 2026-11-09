/**
 * Story-Sektion mit Facettenfilter und Block `popular` (09.11.2026, SFSCON-Startseite):
 * Marker `filter="year=2026"` wird zur Galerie-Filter-Form, `<!-- popular n=5 -->`
 * zum Block ohne Liste; beides nur in layout=story, Unlesbares wirft.
 */
import { describe, it, expect } from 'vitest'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'
import { parseSectionBlocks } from '@/lib/website/parse-section-blocks'
import { storyBloecke } from '@/lib/website/story-section'
import { storyFilterAusAttribut, storyFilterBeschriftung, storyFilterParams } from '@/lib/website/story-filter'

describe('storyFilterAusAttribut', () => {
  it('liest ein Paar, mehrere Paare und mehrere Werte', () => {
    expect(storyFilterAusAttribut('year=2026')).toEqual({ year: ['2026'] })
    expect(storyFilterAusAttribut(' year=2026; track=Legal,Main Track ')).toEqual({ year: ['2026'], track: ['Legal', 'Main Track'] })
    expect(storyFilterBeschriftung({ year: ['2026'], track: ['Legal', 'Main'] })).toBe('year = 2026 · track = Legal, Main')
  })

  it('wirft bei leerem Attribut, fehlendem Gleichheitszeichen, leerem Wert und ungueltigem Namen', () => {
    expect(() => storyFilterAusAttribut('')).toThrow(/leer/)
    expect(() => storyFilterAusAttribut('2026')).toThrow(/facette=wert/)
    expect(() => storyFilterAusAttribut('year=')).toThrow(/ohne Wert/)
    expect(() => storyFilterAusAttribut('ye ar=2026')).toThrow(/ungueltig/)
  })

  it('haengt den Filter als Adress-Parameter an (wie der Chat-Stream)', () => {
    const p = storyFilterParams({ year: ['2026'], track: ['A', 'B'] }, new URLSearchParams({ limit: '1' }))
    expect(p.toString()).toBe('limit=1&year=2026&track=A&track=B')
  })
})

describe('Sektions-Parser: filter und popular', () => {
  it('nimmt filter nur bei layout=story und reicht ihn an die Sektion', () => {
    const [s] = parseWebsiteSections('<!-- section layout=story filter="year=2026" -->\n## Frag.\n<!-- questions -->\n- A?\n<!-- /section -->')
    expect(s.filter).toEqual({ year: ['2026'] })
    expect(() => parseWebsiteSections('<!-- section layout=text-only filter="year=2026" -->\nText\n<!-- /section -->')).toThrow(/filter gilt nur fuer layout=story/)
    expect(() => parseWebsiteSections('<!-- section layout=story filter="year" -->\nText\n<!-- /section -->')).toThrow(/facette=wert/)
  })

  it('parst <!-- popular n=5 --> ohne Liste und prueft n', () => {
    expect(parseSectionBlocks('Text\n\n<!-- popular n=5 -->\n\nDanach')).toEqual([
      { type: 'markdown', markdown: 'Text' },
      { type: 'popular', n: 5 },
      { type: 'markdown', markdown: 'Danach' },
    ])
    expect(parseSectionBlocks('<!-- popular -->')).toEqual([{ type: 'popular', n: 5 }])
    expect(() => parseSectionBlocks('<!-- popular n=0 -->')).toThrow(/1 bis 12/)
    expect(() => parseSectionBlocks('<!-- popular n=x -->')).toThrow(/1 bis 12/)
  })

  it('storyBloecke nimmt popular heraus und meldet n; ausserhalb von story wirft der Parser', () => {
    const [s] = parseWebsiteSections('<!-- section layout=story -->\n## Frag.\n<!-- questions -->\n- A?\n\n<!-- popular n=3 -->\nZeile danach\n<!-- /section -->')
    const b = storyBloecke(s)
    expect(b.populaer).toBe(3)
    expect(b.fragen).toEqual(['A?'])
    expect(b.nach).toEqual([{ type: 'markdown', markdown: 'Zeile danach' }])
    expect(b.vor.some((x) => x.type === 'popular')).toBe(false)
    expect(() => parseWebsiteSections('<!-- section layout=text-only -->\n<!-- popular -->\n<!-- /section -->')).toThrow(/popular --> ist nur in einer Sektion layout=story/)
  })
})

describe('Sektions-Parser: citations', () => {
  it('citations=visible zeigt Zitatmarken von Anfang an; nur bei layout=story; sonst wirft', () => {
    const [s] = parseWebsiteSections('<!-- section layout=story citations=visible -->\nText\n<!-- /section -->')
    expect(s.citationsVisible).toBe(true)
    const [h] = parseWebsiteSections('<!-- section layout=story citations=hidden -->\nText\n<!-- /section -->')
    expect(h.citationsVisible).toBe(false)
    const [o] = parseWebsiteSections('<!-- section layout=story -->\nText\n<!-- /section -->')
    expect(o.citationsVisible).toBeUndefined()
    expect(() => parseWebsiteSections('<!-- section layout=story citations=yes -->\nText\n<!-- /section -->')).toThrow(/visible, hidden/)
    expect(() => parseWebsiteSections('<!-- section layout=text-only citations=visible -->\nText\n<!-- /section -->')).toThrow(/citations gilt nur fuer layout=story/)
  })
})
