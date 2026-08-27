/**
 * Welle ST2 — Ausschnitte und Antwortgrenzen.
 *
 * Der Punkt: ein nicht gefundener Ausschnitt WIRFT, statt leer
 * zurueckzukommen. Leer laese sich als „Feld ist leer" lesen, und genau
 * diese Verwechslung faelscht Befunde.
 */
import { describe, expect, it } from 'vitest'
import { begrenze, schneideBereich } from '@/lib/mcp/storage/bereich'

const DOKUMENT = [
  '---',
  'titel: Klimamaßnahmen Südtirol',
  'bearbeitungsstand: erschlossen',
  '---',
  '',
  '# Bericht',
  '',
  'Einleitung.',
  '',
  '## Befunde',
  '',
  'Zwei offen.',
  '',
  '### Details',
  '',
  'Näheres.',
  '',
  '## Nächste Schritte',
  '',
  'Abnahme.',
].join('\n')

describe('schneideBereich', () => {
  it('liefert den Frontmatter-Block statt der ganzen Datei', () => {
    const fm = schneideBereich(DOKUMENT, { art: 'frontmatter' })
    expect(fm).toBe('---\ntitel: Klimamaßnahmen Südtirol\nbearbeitungsstand: erschlossen\n---')
    expect(Buffer.byteLength(fm)).toBeLessThan(Buffer.byteLength(DOKUMENT))
  })

  it('wirft, wenn es keinen Frontmatter gibt — statt leer zu antworten', () => {
    expect(() => schneideBereich('# Nur Text', { art: 'frontmatter' })).toThrow(/keinen Frontmatter-Block/)
  })

  it('nimmt tiefere Unterueberschriften in den Abschnitt auf', () => {
    const abschnitt = schneideBereich(DOKUMENT, { art: 'abschnitt', ueberschrift: 'Befunde' })
    expect(abschnitt).toContain('Zwei offen.')
    expect(abschnitt).toContain('### Details')
    expect(abschnitt).toContain('Näheres.')
    // Endet vor der naechsten gleichrangigen Ueberschrift.
    expect(abschnitt).not.toContain('Nächste Schritte')
  })

  it('findet die Ueberschrift auch mit fuehrenden Rauten und anderer Schreibweise', () => {
    expect(schneideBereich(DOKUMENT, { art: 'abschnitt', ueberschrift: '## befunde' })).toContain('Zwei offen.')
  })

  it('nennt die vorhandenen Ueberschriften, wenn die gesuchte fehlt', () => {
    expect(() => schneideBereich(DOKUMENT, { art: 'abschnitt', ueberschrift: 'Fazit' }))
      .toThrow(/Vorhanden: # Bericht \| ## Befunde/)
  })

  it('schneidet Zeilen 1-basiert und inklusive', () => {
    expect(schneideBereich(DOKUMENT, { art: 'zeilen', von: 1, bis: 2 }))
      .toBe('---\ntitel: Klimamaßnahmen Südtirol')
  })

  it('wirft bei unsinnigen Zeilenbereichen', () => {
    expect(() => schneideBereich(DOKUMENT, { art: 'zeilen', von: 0, bis: 3 })).toThrow(/ab 1/)
    expect(() => schneideBereich(DOKUMENT, { art: 'zeilen', von: 5, bis: 3 })).toThrow(/liegt vor/)
    expect(() => schneideBereich(DOKUMENT, { art: 'zeilen', von: 999, bis: 1000 })).toThrow(/nur \d+ Zeilen/)
  })
})

describe('begrenze', () => {
  it('meldet gekuerzt und den naechsten Offset', () => {
    const a = begrenze('abcdefghij', 4)
    expect(a).toEqual({ inhalt: 'abcd', gekuerzt: true, gesamtBytes: 10, naechsterOffset: 4 })

    const b = begrenze('abcdefghij', 4, 8)
    expect(b).toEqual({ inhalt: 'ij', gekuerzt: false, gesamtBytes: 10, naechsterOffset: null })
  })

  it('zerschneidet keine Umlaute', () => {
    // "ü" ist 2 Bytes: ein Schnitt nach 1 Byte wuerde es zerreissen.
    const text = 'Südtirol'
    const a = begrenze(text, 2)
    expect(a.inhalt).toBe('S')
    expect(a.naechsterOffset).toBe(1)

    // Ueber alle Offsets hinweg muss sich der Text exakt rekonstruieren.
    let zusammen = ''
    let offset: number | null = 0
    while (offset !== null) {
      const teil: ReturnType<typeof begrenze> = begrenze(text, 3, offset)
      zusammen += teil.inhalt
      offset = teil.naechsterOffset
    }
    expect(zusammen).toBe(text)
  })

  it('antwortet leer statt zu werfen, wenn der Offset hinter dem Ende liegt', () => {
    expect(begrenze('abc', 10, 99)).toEqual({ inhalt: '', gekuerzt: false, gesamtBytes: 3, naechsterOffset: null })
  })

  it('wirft bei unsinnigen Grenzen', () => {
    expect(() => begrenze('abc', 0)).toThrow(/maxBytes/)
    expect(() => begrenze('abc', 10, -1)).toThrow(/offset/)
  })
})
