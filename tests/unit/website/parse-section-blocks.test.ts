/**
 * Welle S3 — Bloecke in Sektionen: Kacheln, Chips, Kasten; Fehler werfen laut.
 */
import { describe, it, expect } from 'vitest'
import { parseSectionBlocks } from '@/lib/website/parse-section-blocks'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'

describe('parseSectionBlocks', () => {
  it('Text ohne Marker bleibt ein Markdown-Block', () => {
    expect(parseSectionBlocks('## Titel\n\nAbsatz.')).toEqual([{ type: 'markdown', markdown: '## Titel\n\nAbsatz.' }])
    expect(parseSectionBlocks('  \n')).toEqual([])
  })

  it('stats: Liste "- **Wert** Beschriftung" wird zu Kacheln, Text davor und danach bleibt', () => {
    const blocks = parseSectionBlocks(`## Loesung\n\nViele Wege.\n\n<!-- stats -->\n- **600+** Massnahmen\n- **5** Handlungsfelder\n\nDanach.`)
    expect(blocks).toEqual([
      { type: 'markdown', markdown: '## Loesung\n\nViele Wege.' },
      { type: 'stats', items: [{ value: '600+', label: 'Massnahmen' }, { value: '5', label: 'Handlungsfelder' }] },
      { type: 'markdown', markdown: 'Danach.' },
    ])
  })

  it('chips: Liste mit optionaler Beschriftung, Fettung wird entfernt', () => {
    const blocks = parseSectionBlocks(`<!-- chips label="Traeger & Partner" -->\n- **Verein A**\n* Verein B`)
    expect(blocks).toEqual([{ type: 'chips', label: 'Traeger & Partner', items: ['Verein A', 'Verein B'] }])
  })

  it('box: bis zum Ende-Marker, kind card als Vorgabe, note erlaubt', () => {
    const blocks = parseSectionBlocks(`<!-- box label="Bald" -->\n**Aus der Praxis**\nInitiativen eintragen.\n<!-- /box -->\n\n<!-- box kind=note -->\nTermin am 30.09.\n<!-- /box -->`)
    expect(blocks).toEqual([
      { type: 'box', label: 'Bald', kind: 'card', markdown: '**Aus der Praxis**\nInitiativen eintragen.' },
      { type: 'box', label: undefined, kind: 'note', markdown: 'Termin am 30.09.' },
    ])
  })

  it('wirft bei Kachel ohne Wert, Block ohne Liste, Kasten ohne Ende, unbekanntem kind', () => {
    expect(() => parseSectionBlocks('<!-- stats -->\n- 600 Massnahmen')).toThrow(/Kachel-Zeile "600 Massnahmen"/)
    expect(() => parseSectionBlocks('<!-- chips -->\n\nKein Listenpunkt')).toThrow(/chips-Block ohne Liste/)
    expect(() => parseSectionBlocks('<!-- box -->\nohne Ende')).toThrow(/box-Block ohne Ende/)
    expect(() => parseSectionBlocks('<!-- box kind=banner -->x<!-- /box -->')).toThrow(/box kind="banner"/)
  })

  it('haengt an jeder Sektion als blocks; Sektions-Marker bleiben davon unberuehrt', () => {
    const [s] = parseWebsiteSections('<!-- section layout=image-right bg=brand -->\n## L\n<!-- stats -->\n- **2040** Ziel\n<!-- /section -->')
    expect(s.blocks).toHaveLength(2)
    expect(s.blocks[1]).toEqual({ type: 'stats', items: [{ value: '2040', label: 'Ziel' }] })
    expect(() => parseWebsiteSections('<!-- section -->\n<!-- stats -->\nx\n<!-- /section -->')).toThrow(/stats-Block ohne Liste/)
  })
})
