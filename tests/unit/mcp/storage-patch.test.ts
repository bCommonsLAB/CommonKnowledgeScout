/**
 * Welle ST3 — `datei_patchen`.
 *
 * Der Beleg: BERICHT.md und _INDEX.md wurden an einem Tag achtmal komplett
 * neu geschrieben, meist wegen einer einzigen Zahl — ~80 kB fuer ~400 Bytes
 * echte Aenderung.
 *
 * Der wichtigste Test ist der letzte Block: Die Frontmatter-Chirurgie darf
 * fremde Zeilen NICHT anfassen. Genau daran ist der Single-Serializer
 * gescheitert (Befund 24.08.2026: `type: index` wurde zu `type: "index"`).
 */
import { describe, expect, it } from 'vitest'
import { wendePatchAn, zaehleVorkommen } from '@/lib/mcp/storage/patch'
import { formatiereWert } from '@/lib/mcp/storage/frontmatter-felder'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

const BERICHT = [
  '---',
  'type: index',
  'titel: Klimamaßnahmen Südtirol',
  'anzahl: 606',
  'geprueft: false',
  '---',
  '',
  '# Bericht',
  '',
  '## Befunde',
  '',
  '38 Befunde offen.',
  '',
  '### Details',
  '',
  'Näheres.',
  '',
  '## Nächste Schritte',
  '',
  'Abnahme.',
].join('\n')

describe('zaehleVorkommen', () => {
  it('zaehlt woertlich, ohne Regex-Bedeutung von Sonderzeichen', () => {
    expect(zaehleVorkommen('a.b a.b axb', 'a.b')).toBe(2)
    expect(zaehleVorkommen('aaa', 'aa')).toBe(1) // ohne Ueberlappung
    expect(zaehleVorkommen('abc', '')).toBe(0)
  })
})

describe('wendePatchAn: ersetze', () => {
  it('ersetzt einen eindeutigen Treffer', () => {
    const { inhalt } = wendePatchAn(BERICHT, { art: 'ersetze', altText: '38 Befunde offen.', neuText: '30 Befunde offen.' })
    expect(inhalt).toContain('30 Befunde offen.')
    expect(inhalt).not.toContain('38 Befunde')
  })

  it('lehnt mehrdeutige Treffer ab, statt zu raten', () => {
    expect(() => wendePatchAn('x\nx\n', { art: 'ersetze', altText: 'x', neuText: 'y' }))
      .toThrow(/kommt 2-mal vor/)
  })

  it('sagt bei fehlendem Treffer, dass die gelesene Fassung veraltet sein duerfte', () => {
    expect(() => wendePatchAn(BERICHT, { art: 'ersetze', altText: 'gibt es nicht', neuText: 'x' }))
      .toThrow(/neu lesen und erneut patchen/)
  })

  it('behandelt "$" im Ersatztext woertlich (kein Regex-Ersatzmuster)', () => {
    const { inhalt } = wendePatchAn('Preis: alt', { art: 'ersetze', altText: 'alt', neuText: '$& $1 100€' })
    expect(inhalt).toBe('Preis: $& $1 100€')
  })
})

describe('wendePatchAn: abschnitt_ersetzen', () => {
  it('ersetzt bis zur naechsten gleichrangigen Ueberschrift, inklusive tieferer', () => {
    const { inhalt } = wendePatchAn(BERICHT, {
      art: 'abschnitt_ersetzen', ueberschrift: '## Befunde', neuerInhalt: '## Befunde\n\nAlles erledigt.',
    })
    expect(inhalt).toContain('Alles erledigt.')
    expect(inhalt).not.toContain('38 Befunde')
    expect(inhalt).not.toContain('### Details')
    // Was danach kommt, bleibt.
    expect(inhalt).toContain('## Nächste Schritte')
    expect(inhalt).toContain('Abnahme.')
    // Und was davor kommt, auch — Frontmatter inklusive.
    expect(inhalt.startsWith('---\ntype: index')).toBe(true)
  })

  it('sieht dieselbe Grenze wie das Lesen', () => {
    const { inhalt } = wendePatchAn(BERICHT, {
      art: 'abschnitt_ersetzen', ueberschrift: 'Nächste Schritte', neuerInhalt: '## Nächste Schritte\n\nFertig.',
    })
    expect(inhalt).toContain('Fertig.')
    expect(inhalt).toContain('38 Befunde offen.')
  })
})

describe('formatiereWert', () => {
  it('laesst harmlose Werte plain — die Datei sieht unveraendert aus', () => {
    expect(formatiereWert('erschlossen')).toBe('erschlossen')
    expect(formatiereWert('Klimamaßnahmen Südtirol')).toBe('Klimamaßnahmen Südtirol')
    expect(formatiereWert(606)).toBe('606')
    expect(formatiereWert(true)).toBe('true')
  })

  it('quotet, wo der Parser sonst etwas anderes daraus machen wuerde', () => {
    expect(formatiereWert('123')).toBe('"123"')       // sonst Zahl
    expect(formatiereWert('true')).toBe('"true"')     // sonst Boolean
    expect(formatiereWert(' Rand ')).toBe('" Rand "') // sonst getrimmt
    expect(formatiereWert('')).toBe('""')
    expect(formatiereWert('a\nb')).toBe('"a\\nb"')    // sonst Blockbruch
    expect(formatiereWert('- Liste')).toBe('"- Liste"')
  })
})

describe('wendePatchAn: frontmatter_setzen', () => {
  it('setzt nur die genannten Felder und laesst fremde Zeilen BYTE FUER BYTE stehen', () => {
    const { inhalt } = wendePatchAn(BERICHT, {
      art: 'frontmatter_setzen', felder: { anzahl: 610, geprueft: true },
    })
    // Der Befund vom 24.08.2026: type/titel duerfen NICHT gequotet werden.
    expect(inhalt).toContain('type: index')
    expect(inhalt).toContain('titel: Klimamaßnahmen Südtirol')
    expect(inhalt).toContain('anzahl: 610')
    expect(inhalt).toContain('geprueft: true')
    // Body unangetastet.
    expect(inhalt).toContain('38 Befunde offen.')
    expect(inhalt).toContain('### Details')
  })

  it('ergaenzt ein noch nicht vorhandenes Feld', () => {
    const { inhalt } = wendePatchAn(BERICHT, { art: 'frontmatter_setzen', felder: { thema: 'ACT-Klima' } })
    expect(parseFrontmatter(inhalt).meta.thema).toBe('ACT-Klima')
    expect(parseFrontmatter(inhalt).meta.type).toBe('index')
  })

  it('haelt den Roundtrip: geschrieben ist gleich zurueckgelesen', () => {
    const felder = { titel: '123', notiz: ' mit Rand ', zahl: 42, flagge: false, text: 'ABOUT THE "HUMANIZATION"' }
    const { inhalt } = wendePatchAn(BERICHT, { art: 'frontmatter_setzen', felder })
    const meta = parseFrontmatter(inhalt).meta
    for (const [key, wert] of Object.entries(felder)) expect(meta[key]).toBe(wert)
  })

  it('lehnt Dot-Notation und verschachtelte Werte ab (Frontmatter bleibt flach)', () => {
    expect(() => wendePatchAn(BERICHT, { art: 'frontmatter_setzen', felder: { 'a.b': 'x' } }))
      .toThrow(/Keine Dot-Notation/)
    expect(() => wendePatchAn(BERICHT, { art: 'frontmatter_setzen', felder: { twin: { a: 1 } } }))
      .toThrow(/Listen und Objekte/)
    expect(() => wendePatchAn(BERICHT, { art: 'frontmatter_setzen', felder: { tags: ['a'] } }))
      .toThrow(/Listen und Objekte/)
  })

  it('legt einen Frontmatter-Block an, wenn keiner da ist, ohne den Body zu ruehren', () => {
    const { inhalt } = wendePatchAn('# Nur Text\n', { art: 'frontmatter_setzen', felder: { titel: 'Neu' } })
    expect(parseFrontmatter(inhalt).meta.titel).toBe('Neu')
    expect(inhalt).toContain('# Nur Text')
  })
})
