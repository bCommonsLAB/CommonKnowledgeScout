/**
 * Marker-Attribute `cards` und `rules` der Story-Sektion (Owner 09.11.2026):
 * Parser (nur layout=story, Unlesbares wirft), Bericht `seite_pruefen`
 * (kartenDarstellung, regelsatz, Befund bei fehlendem Regelsatz) und die
 * Bezeichnung der Eintraege.
 */
import { describe, it, expect, vi } from 'vitest'
import type { DocCardMeta } from '@ks/contracts'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'
import { baueSeitenBericht, regelsatzBefunde } from '@/lib/mcp/website-seite'
import { eintragsBezeichnung } from '@/lib/website/eintrags-bezeichnung'

const story = (attrs: string) => `<!-- section layout=story ${attrs} -->\n## Frag.\n<!-- questions -->\n- A?\n<!-- /section -->`

describe('Sektions-Parser: cards und rules', () => {
  it('liest cards=column|inline|hidden und rules=<name>; ohne Marker beides undefined', () => {
    expect(parseWebsiteSections(story('cards=column'))[0].cards).toBe('column')
    expect(parseWebsiteSections(story('cards=inline rules=einladung'))[0]).toMatchObject({ cards: 'inline', rules: 'einladung' })
    expect(parseWebsiteSections(story('cards=hidden'))[0].cards).toBe('hidden')
    const [o] = parseWebsiteSections(story(''))
    expect(o.cards).toBeUndefined()
    expect(o.rules).toBeUndefined()
  })

  it('wirft bei unlesbaren Werten und ausserhalb von layout=story', () => {
    expect(() => parseWebsiteSections(story('cards=grid'))).toThrow(/cards="grid".*hidden, column, inline/)
    expect(() => parseWebsiteSections(story('rules="Einladung Gross"'))).toThrow(/rules=/)
    expect(() => parseWebsiteSections('<!-- section layout=text-only cards=column -->\nText\n<!-- /section -->')).toThrow(/cards gilt nur fuer layout=story/)
    expect(() => parseWebsiteSections('<!-- section layout=banner rules=x -->\nText\n<!-- /section -->')).toThrow(/rules gilt nur fuer layout=story/)
  })
})

describe('seite_pruefen: kartenDarstellung und regelsatz', () => {
  const home = { id: 'home', fileId: 'home', title: 'Start', detailViewType: 'website', menu_order: 1 } as DocCardMeta
  const md = story('filter="year=2026" cards=inline rules=einladung')

  it('nennt beide je Story-Sektion und meldet einen fehlenden Regelsatz als Fehler', () => {
    const ok = baueSeitenBericht([home], new Map([['home', md]]), { starCountsPublic: false, bannerSortJeFileId: new Map(), regelsaetze: ['einladung'] })
    expect(ok.seiten[0].sektionen[0]).toMatchObject({ layout: 'story', kartenDarstellung: 'inline', regelsatz: 'einladung', filter: { year: ['2026'] } })
    expect(ok.seiten[0].fehler).toEqual([])

    const fehlt = baueSeitenBericht([home], new Map([['home', md]]), { starCountsPublic: false, bannerSortJeFileId: new Map(), regelsaetze: ['kurz'] })
    expect(fehlt.seiten[0].fehler.some((f) => f.includes('rules=einladung') && f.includes('vorhanden: kurz'))).toBe(true)
  })

  it('ohne Kontext (Tests ohne Library) keine Regelsatz-Pruefung; regelsatzBefunde direkt', () => {
    const b = baueSeitenBericht([home], new Map([['home', md]]))
    expect(b.seiten[0].fehler).toEqual([])
    const sections = parseWebsiteSections(md)
    expect(regelsatzBefunde(sections, [])).toHaveLength(1)
    expect(regelsatzBefunde(sections, [])[0]).toMatch(/keine benannten Regelsaetze/)
    expect(regelsatzBefunde(sections, ['einladung'])).toEqual([])
  })
})

describe('eintragsBezeichnung', () => {
  const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key)

  it('mit Einzahl und Mehrzahl tragen alle Texte die Bezeichnung', () => {
    const b = eintragsBezeichnung({ itemLabel: 'Talk', itemLabelPlural: 'Talks' }, t)
    expect(b.eigen).toBe(true)
    expect(b.zitiert(1)).toBe('website.story.bezeichnungZitiertEins:Talk')
    expect(b.zitiert(5)).toBe('website.story.bezeichnungZitiert:5,Talks')
    expect(b.anzeigen).toBe('website.story.bezeichnungAnzeigen:Talks')
    expect(b.spalte).toBe('website.story.bezeichnungSpalte:Talks')
    expect(b.weitere).toBe('website.story.bezeichnungWeitere:Talks')
    expect(b.blattTitel).toBe('Talks')
  })

  it('ohne Eintrag die heutigen Texte; nur eine Haelfte wird gemeldet und zaehlt nicht', () => {
    const ohne = eintragsBezeichnung(undefined, t)
    expect(ohne.eigen).toBe(false)
    expect(ohne.zitiert(1)).toBe('story.konversation.quellenZitiert.one')
    expect(ohne.zitiert(3)).toBe('story.konversation.quellenZitiert.many:3')
    expect(ohne.anzeigen).toBe('website.story.quellenAnzeigenKurz')
    expect(ohne.blattTitel).toBeUndefined()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const halb = eintragsBezeichnung({ itemLabel: 'Talk' }, t)
    expect(halb.eigen).toBe(false)
    expect(err).toHaveBeenCalledTimes(1)
    err.mockRestore()
  })
})
