/**
 * Wellen W1/W2/W4 — Fortschreiben statt Ersetzen.
 *
 * Beleg aus drei Wochendurchgaengen: Jeder neue Wochenabschnitt lief als
 * `ersetze` auf "## Verweise" — die Ueberschrift wanderte hin und zurueck,
 * nur damit sie stehen blieb. Eine Chronologie-Zeile kostete das
 * Neuschreiben der ganzen Tabelle.
 */
import { describe, expect, it } from 'vitest'
import { wendePatchAn, wendePatchesAn } from '@/lib/mcp/storage/patch'

const BERICHT = [
  '---',
  'titel: Bericht',
  '---',
  '',
  '## Woche 1',
  '',
  'Text der ersten Woche.',
  '',
  '### Detail',
  '',
  'Untergeordnet.',
  '',
  '## Verweise',
  '',
  '- [Konventionen](Konventionen.md)',
].join('\n')

const MIT_TABELLE = [
  '## Chronologie',
  '',
  '| Datum | Ereignis |',
  '|---|---|',
  '| 2026-08-26 | Erster Durchgang |',
  '',
  '## Verweise',
  '',
  '| Quelle | Ziel |',
  '|---|---|',
  '| a | b |',
].join('\n')

describe('abschnitt_einfuegen', () => {
  it('setzt einen Block VOR die Ueberschrift — das Ritual mit ersetze entfaellt', () => {
    const r = wendePatchAn(BERICHT, {
      art: 'abschnitt_einfuegen', ueberschrift: '## Verweise', position: 'vor',
      inhalt: '## Woche 2\n\nText der zweiten Woche.\n',
    })
    const zeilen = r.inhalt.split('\n')
    expect(zeilen.indexOf('## Woche 2')).toBeLessThan(zeilen.indexOf('## Verweise'))
    // Die alte Ueberschrift steht genau einmal — sie wurde nicht mitgeschrieben.
    expect(zeilen.filter((z) => z === '## Verweise')).toHaveLength(1)
    expect(r.inhalt).toContain('- [Konventionen](Konventionen.md)')
  })

  it('setzt "nach" hinter den GANZEN Abschnitt, nicht hinter die Ueberschriftszeile', () => {
    const r = wendePatchAn(BERICHT, {
      art: 'abschnitt_einfuegen', ueberschrift: '## Woche 1', position: 'nach',
      inhalt: '## Woche 2',
    })
    const zeilen = r.inhalt.split('\n')
    // Der Unterabschnitt "### Detail" gehoert zu Woche 1 und bleibt davor.
    expect(zeilen.indexOf('### Detail')).toBeLessThan(zeilen.indexOf('## Woche 2'))
    expect(zeilen.indexOf('## Woche 2')).toBeLessThan(zeilen.indexOf('## Verweise'))
  })

  it('lehnt leeren Inhalt ab, statt einen Patch ohne Wirkung zu schreiben', () => {
    expect(() => wendePatchAn(BERICHT, {
      art: 'abschnitt_einfuegen', ueberschrift: '## Verweise', position: 'vor', inhalt: '',
    })).toThrow(/darf nicht leer sein/)
  })

  it('nennt die vorhandenen Ueberschriften, wenn die Marke nicht trifft', () => {
    expect(() => wendePatchAn(BERICHT, {
      art: 'abschnitt_einfuegen', ueberschrift: '## Fehlt', position: 'vor', inhalt: 'x',
    })).toThrow(/Vorhanden: .*Woche 1/)
  })
})

describe('tabelle_zeile_einfuegen', () => {
  it('haengt eine Zeile an, ohne die Tabelle neu zu schreiben', () => {
    const r = wendePatchAn(MIT_TABELLE, {
      art: 'tabelle_zeile_einfuegen', ueberschrift: '## Chronologie',
      zeile: '| 2026-09-02 | Dritter Durchgang |', position: 'ende',
    })
    expect(r.inhalt).toContain('| 2026-08-26 | Erster Durchgang |\n| 2026-09-02 | Dritter Durchgang |')
  })

  it('setzt bei position="anfang" hinter Kopf UND Trennzeile', () => {
    const r = wendePatchAn(MIT_TABELLE, {
      art: 'tabelle_zeile_einfuegen', ueberschrift: '## Chronologie',
      zeile: '| 2026-09-02 | Neuestes zuerst |', position: 'anfang',
    })
    expect(r.inhalt).toContain('|---|---|\n| 2026-09-02 | Neuestes zuerst |\n| 2026-08-26 |')
  })

  it('raet nicht, wenn die Datei mehrere Tabellen hat', () => {
    expect(() => wendePatchAn(MIT_TABELLE, {
      art: 'tabelle_zeile_einfuegen', zeile: '| x | y |', position: 'ende',
    })).toThrow(/2 Tabellen in der Datei/)
  })

  it('verlangt eine echte Tabellenzeile', () => {
    expect(() => wendePatchAn(MIT_TABELLE, {
      art: 'tabelle_zeile_einfuegen', ueberschrift: '## Chronologie', zeile: 'kein Pipe', position: 'ende',
    })).toThrow(/mit "\|" beginnen/)
  })

  it('meldet eine fehlende Tabelle, statt irgendwo einzufuegen', () => {
    expect(() => wendePatchAn(BERICHT, {
      art: 'tabelle_zeile_einfuegen', ueberschrift: '## Verweise', zeile: '| a | b |', position: 'ende',
    })).toThrow(/Keine Markdown-Tabelle/)
  })
})

describe('wendePatchesAn (Stapel)', () => {
  it('wendet mehrere Aenderungen in Reihenfolge an und beschreibt jede', () => {
    const r = wendePatchesAn(MIT_TABELLE, [
      { art: 'tabelle_zeile_einfuegen', ueberschrift: '## Chronologie', zeile: '| 2026-09-02 | Neu |', position: 'ende' },
      { art: 'abschnitt_einfuegen', ueberschrift: '## Verweise', position: 'vor', inhalt: '## Woche 3\n' },
    ])
    expect(r.inhalt).toContain('| 2026-09-02 | Neu |')
    expect(r.inhalt).toContain('## Woche 3')
    expect(r.beschreibung).toMatch(/^1\. .* · 2\. /)
  })

  it('laesst einen Schritt auf dem Ergebnis des vorigen aufsetzen', () => {
    const r = wendePatchesAn(BERICHT, [
      { art: 'abschnitt_einfuegen', ueberschrift: '## Verweise', position: 'vor', inhalt: '## Woche 2\n' },
      { art: 'abschnitt_einfuegen', ueberschrift: '## Woche 2', position: 'nach', inhalt: 'Nachtrag.' },
    ])
    expect(r.inhalt).toContain('## Woche 2\n\nNachtrag.')
  })

  it('schreibt NICHTS, wenn ein spaeterer Schritt scheitert — und nennt die Nummer', () => {
    expect(() => wendePatchesAn(BERICHT, [
      { art: 'abschnitt_einfuegen', ueberschrift: '## Verweise', position: 'vor', inhalt: '## Woche 2\n' },
      { art: 'ersetze', altText: 'gibt es nicht', neuText: 'x' },
    ])).toThrow(/Schritt 2 von 2 .* NICHTS geschrieben/s)
  })

  it('lehnt einen leeren Stapel ab', () => {
    expect(() => wendePatchesAn(BERICHT, [])).toThrow(/darf nicht leer sein/)
  })
})
