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

describe('parseSectionBlocks — questions (Welle N1)', () => {
  it('questions: Liste wird zu Beispielfragen, Text davor und danach bleibt', () => {
    const blocks = parseSectionBlocks(`## Frag drauflos.\n\nZum Beispiel:\n\n<!-- questions -->\n- Wie veraendert der Klimawandel die Artenvielfalt?\n- **Welche Arten** sind gefaehrdet?\n\n✓ Mit Quellen`)
    expect(blocks).toEqual([
      { type: 'markdown', markdown: '## Frag drauflos.\n\nZum Beispiel:' },
      { type: 'questions', items: ['Wie veraendert der Klimawandel die Artenvielfalt?', 'Welche Arten sind gefaehrdet?'] },
      { type: 'markdown', markdown: '✓ Mit Quellen' },
    ])
  })

  it('questions ohne Liste wirft', () => {
    expect(() => parseSectionBlocks('<!-- questions -->\nKeine Liste.')).toThrow(/questions-Block ohne Liste/)
  })
})

describe('parseSectionBlocks — cards (Welle N2)', () => {
  const DREI = [
    '<!-- cards -->',
    '- **Das Wissensarchiv entdecken** Stoebere in Studien und Berichten. [Zum Archiv →](?view=gallery)',
    '- **Inhaltsverzeichnis** Die Themen des Bestands. [Zu den Themen →](?mode=story)',
    '- **Wie funktioniert der KnowledgeScout?** Was der Scout kann. [Mehr erfahren →](?site=wie-funktioniert)',
  ].join('\n')

  it('cards: Liste "- **Titel** Text [Linktext](Ziel)" wird zu Karten, Text davor und danach bleibt', () => {
    const blocks = parseSectionBlocks(`## Drei Wege\n\n${DREI}\n\nDanach.`)
    expect(blocks).toEqual([
      { type: 'markdown', markdown: '## Drei Wege' },
      {
        type: 'cards',
        items: [
          { title: 'Das Wissensarchiv entdecken', text: 'Stoebere in Studien und Berichten.', linkLabel: 'Zum Archiv →', href: '?view=gallery' },
          { title: 'Inhaltsverzeichnis', text: 'Die Themen des Bestands.', linkLabel: 'Zu den Themen →', href: '?mode=story' },
          { title: 'Wie funktioniert der KnowledgeScout?', text: 'Was der Scout kann.', linkLabel: 'Mehr erfahren →', href: '?site=wie-funktioniert' },
        ],
      },
      { type: 'markdown', markdown: 'Danach.' },
    ])
  })

  it('cards: fuehrendes :symbol: am Textanfang wird zum Icon, Rest bleibt Text', () => {
    const [block] = parseSectionBlocks('<!-- cards -->\n- **Archiv** :archive: Stöbere in Studien. [Zum Archiv](?view=gallery)\n- **Themen** :list: Die Themen. [Zu den Themen](?mode=story)')
    expect(block).toEqual({
      type: 'cards',
      items: [
        { title: 'Archiv', text: 'Stöbere in Studien.', linkLabel: 'Zum Archiv', href: '?view=gallery', icon: 'archive' },
        { title: 'Themen', text: 'Die Themen.', linkLabel: 'Zu den Themen', href: '?mode=story', icon: 'list' },
      ],
    })
  })

  it('cards: unbekanntes :symbol: wirft (kein stiller Fallback)', () => {
    expect(() => parseSectionBlocks('<!-- cards -->\n- **Archiv** :rakete: Text [Hin](?view=gallery)')).toThrow(/Unbekanntes Karten-Symbol ":rakete:"/)
  })

  it('cards: Text darf fehlen, absolute Adresse ist ein gueltiges Ziel', () => {
    const [block] = parseSectionBlocks('<!-- cards -->\n- **Museum** [Zur Website](https://example.org/museum)')
    expect(block).toEqual({
      type: 'cards',
      items: [{ title: 'Museum', text: '', linkLabel: 'Zur Website', href: 'https://example.org/museum' }],
    })
  })

  it('cards wirft bei Eintrag ohne **Titel**, ohne Link, bei Block ohne Liste und bei unbekanntem Ziel', () => {
    expect(() => parseSectionBlocks('<!-- cards -->\n- Archiv [Hin](?view=gallery)')).toThrow(/Karten-Zeile "Archiv \[Hin\]\(\?view=gallery\)"/)
    expect(() => parseSectionBlocks('<!-- cards -->\n- **Archiv** Nur Text, kein Link')).toThrow(/Karten-Zeile/)
    expect(() => parseSectionBlocks('<!-- cards -->\n\nKeine Liste')).toThrow(/cards-Block ohne Liste/)
    expect(() => parseSectionBlocks('<!-- cards -->\n- **Archiv** [Hin](/explore/x)')).toThrow(/Kachel-Ziel "\/explore\/x" ist unbekannt/)
    expect(() => parseSectionBlocks('<!-- cards -->\n- **Archiv** [Hin](?view=map)')).toThrow(/view="map"/)
  })

  it('cards sind in jeder Sektion erlaubt, auch ohne Story-Sektion', () => {
    const [s] = parseWebsiteSections(`<!-- section layout=text-only bg=default -->\n${DREI}\n<!-- /section -->`)
    expect(s.blocks).toHaveLength(1)
    expect(s.blocks[0].type).toBe('cards')
  })
})
