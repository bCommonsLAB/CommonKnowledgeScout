/**
 * Vorpruefung des Composite-Kontextfensters: Quellenzeilen nur im Abschnitt
 * „Quellenübersicht" zaehlen (Befund 06.11.2026: nummerierte Tabellen im
 * Folientext galten als Quellen und liessen den Job vor dem LLM abbrechen).
 */

import { describe, expect, it } from 'vitest'
import {
  quellenuebersichtAbschnitt,
  validateCompositeContextWindow,
  zaehleQuellenzeilen,
} from '@/lib/external-jobs/composite-context-window'

function uebersicht(zeilen: string[]): string {
  return [
    '---',
    '_source_files: ["talk.md"]',
    'kind: composite-transcript',
    '---',
    '',
    '# Quellenübersicht',
    '',
    '| Nr. | Datei | Typ |',
    '|-----|-------|-----|',
    ...zeilen,
  ].join('\n')
}

function block(name: string, inhalt: string): string {
  return `<source file="${name}">\n${inhalt}\n</source>`
}

/** Folientext mit einer nummerierten Tabelle — sieht aus wie Quellenzeilen, ist keine. */
const folienTabelle = [
  '# Programm',
  '',
  '| Nr. | Slot | Uhrzeit |',
  '|---|---|---|',
  '| 1 | Opening | 09:00 |',
  '| 2 | Keynote | 09:30 |',
  '| 3 | Break | 10:30 |',
  '| 4 | Panel | 11:00 |',
  '| 5 | Lunch | 12:30 |',
  '| 6 | Workshop | 14:00 |',
].join('\n')

describe('validateCompositeContextWindow', () => {
  it('zaehlt nur die Zeilen der Quellenübersicht, nicht Tabellen im Folientext', () => {
    const text = [
      uebersicht(['| 1 | talk.md | Markdown |']),
      '',
      '## Verfügbare Medien',
      '',
      '### Im Quellverzeichnis',
      '- cover.jpg (Bild, 12 KB)',
      '',
      block('talk.md', folienTabelle),
    ].join('\n')

    expect(zaehleQuellenzeilen(text)).toBe(1)
    expect(validateCompositeContextWindow(text)).toEqual({ ok: true })
  })

  it('endet am ersten Source-Block, wenn keine Medienliste dazwischen steht', () => {
    const text = [uebersicht(['| 1 | talk.md | Markdown |']), '', block('talk.md', folienTabelle)].join('\n')
    expect(quellenuebersichtAbschnitt(text)).not.toContain('Opening')
    expect(zaehleQuellenzeilen(text)).toBe(1)
  })

  it('meldet fehlende Source-Bloecke bei zwei Quellen', () => {
    const text = [uebersicht(['| 1 | a.md | Markdown |', '| 2 | b.pdf | PDF |']), '', block('a.md', 'A')].join('\n')
    const result = validateCompositeContextWindow(text)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('meldet 2 Quelle(n)')
      expect(result.message).toContain('open=<source file= 1')
    }
  })

  it('akzeptiert zwei Quellen mit zwei Bloecken, auch mit nummerierter Tabelle im Block', () => {
    const text = [
      uebersicht(['| 1 | a.md | Markdown |', '| 2 | b.pdf | PDF |']),
      '',
      '## Verfügbare Medien',
      '',
      block('a.md', 'A'),
      block('b.pdf', folienTabelle),
    ].join('\n')
    expect(validateCompositeContextWindow(text)).toEqual({ ok: true })
  })

  it('laesst Text ohne Quellenübersicht durch', () => {
    expect(validateCompositeContextWindow(folienTabelle)).toEqual({ ok: true })
    expect(validateCompositeContextWindow('')).toEqual({ ok: true })
    expect(zaehleQuellenzeilen(folienTabelle)).toBe(0)
  })
})
