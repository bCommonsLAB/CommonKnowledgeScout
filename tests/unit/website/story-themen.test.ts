/**
 * Sektion `layout=topics` (Owner 18.11.2026): Themenuebersicht des Story-Modus
 * auf der Startseite. Parser-Regeln und der Ablauf einer gewaehlten Frage.
 */
import { describe, it, expect } from 'vitest'
import { parseWebsiteSections, auftragSchritt } from '@ks/module-website'

const STORY = '<!-- section layout=story -->\n## Frag.\n<!-- questions -->\n- A?\n<!-- /section -->'

describe('layout=topics im Parser', () => {
  it('liest die Sektion mit ganzem Markdown und ohne Bild-Auszug', () => {
    const sections = parseWebsiteSections(`${STORY}\n\n<!-- section layout=topics bg=light kicker="Inhalte" -->\n## Was hier drin steckt\n![Bild](https://example.org/a.png)\nText\n<!-- /section -->`)
    const t = sections[1]
    expect(t.layout).toBe('topics')
    expect(t.bg).toBe('light')
    expect(t.kicker).toBe('Inhalte')
    expect(t.imageUrl).toBeUndefined()
    expect(t.markdown).toContain('![Bild](https://example.org/a.png)')
    expect(t.blocks[0]).toEqual({ type: 'markdown', markdown: '## Was hier drin steckt\n![Bild](https://example.org/a.png)\nText' })
  })

  it('wirft ohne Story-Sektion auf derselben Seite', () => {
    expect(() => parseWebsiteSections('<!-- section layout=topics -->\n## Inhalte\n<!-- /section -->')).toThrow(/braucht eine Sektion layout=story/)
  })

  it('wirft bei zwei Themen-Sektionen', () => {
    const zwei = `${STORY}\n<!-- section layout=topics -->\nA\n<!-- /section -->\n<!-- section layout=topics -->\nB\n<!-- /section -->`
    expect(() => parseWebsiteSections(zwei)).toThrow(/Hoechstens eine Sektion layout=topics/)
  })

  it('Story-Attribute und -Bloecke bleiben story vorbehalten', () => {
    expect(() => parseWebsiteSections(`${STORY}\n<!-- section layout=topics rules=ausprobieren -->\nA\n<!-- /section -->`)).toThrow()
    expect(() => parseWebsiteSections(`${STORY}\n<!-- section layout=topics placeholder="x" -->\nA\n<!-- /section -->`)).toThrow()
    expect(() => parseWebsiteSections(`${STORY}\n<!-- section layout=topics -->\n<!-- questions -->\n- B?\n<!-- /section -->`)).toThrow(/nur in einer Sektion layout=story/)
  })
})

describe('auftragSchritt', () => {
  it('wartet, solange die Story-Sektion laedt', () => {
    expect(auftragSchritt({ laedt: true, fehler: false, laeuft: false })).toBe('warten')
  })
  it('verwirft laut, wenn die Story-Sektion einen Fehler zeigt', () => {
    expect(auftragSchritt({ laedt: false, fehler: true, laeuft: false })).toBe('verwerfen')
  })
  it('traegt die Frage ein, solange eine Antwort laeuft — sie geht nicht verloren', () => {
    expect(auftragSchritt({ laedt: false, fehler: false, laeuft: true })).toBe('eintragen')
  })
  it('stellt die Frage sofort, wenn die Sektion bereit ist', () => {
    expect(auftragSchritt({ laedt: false, fehler: false, laeuft: false })).toBe('senden')
  })
})
