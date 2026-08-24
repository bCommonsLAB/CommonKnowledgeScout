/**
 * @fileoverview Unit-Tests: zeilen-chirurgischer Stand-Patch (W7-Nachzug).
 *
 * Der Vertrag aus dem Test-Befund 24.08.: NUR die Stand-Zeilen aendern sich —
 * fremde Zeilen behalten Byte fuer Byte ihre Schreibweise (unquotete Werte,
 * Kommentare, Leerzeilen, CRLF). Fehlende Keys werden ergaenzt, eine Datei
 * ohne Frontmatter bekommt einen Block, ein unabschliessbarer Block bricht
 * laut ab.
 */

import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchStandZeilen } from '@/lib/agent-view/stand-zeilen-patch'

const PATCH = { bearbeitungsstand: 'abgenommen', bearbeitungsstand_seit: '2026-08-24' }

describe('patchStandZeilen', () => {
  it('ersetzt nur die Stand-Zeilen — fremde Zeilen bleiben Byte fuer Byte stehen', () => {
    const markdown = [
      '---',
      'type: index',
      '# von Hand gepflegt',
      'bearbeitungsstand: berichtet',
      'projekt:   Pilotprojekt Klima  ',
      'bearbeitungsstand_seit: 2026-08-18',
      '',
      'preis: 3 $ und mehr',
      '---',
      '',
      '# Pilot',
      'Body bleibt.',
    ].join('\n')

    const ergebnis = patchStandZeilen(markdown, PATCH)

    expect(ergebnis).toContain('type: index')
    expect(ergebnis).not.toContain('"index"')
    expect(ergebnis).toContain('# von Hand gepflegt')
    expect(ergebnis).toContain('projekt:   Pilotprojekt Klima  ')
    expect(ergebnis).toContain('preis: 3 $ und mehr')
    expect(ergebnis).toContain('bearbeitungsstand: abgenommen')
    expect(ergebnis).toContain('bearbeitungsstand_seit: 2026-08-24')
    expect(ergebnis).not.toContain('berichtet')
    // Der echte Parser liest das Ergebnis (dieselbe Pruefung faehrt stand-schreiben vor dem Write).
    const { meta, body } = parseFrontmatter(ergebnis)
    expect(meta.bearbeitungsstand).toBe('abgenommen')
    expect(body).toContain('Body bleibt.')
  })

  it('ergaenzt fehlende Stand-Zeilen am Blockende, ohne bestehende Zeilen anzufassen', () => {
    const markdown = '---\ntype: index\n---\n\nBody\n'
    const ergebnis = patchStandZeilen(markdown, PATCH)
    expect(ergebnis).toBe(
      '---\ntype: index\nbearbeitungsstand: abgenommen\nbearbeitungsstand_seit: 2026-08-24\n---\n\nBody\n',
    )
  })

  it('eine Datei ohne Frontmatter bekommt einen neuen Block, der Body bleibt unveraendert', () => {
    const ergebnis = patchStandZeilen('# Nur Body\n', PATCH)
    expect(ergebnis).toBe(
      '---\nbearbeitungsstand: abgenommen\nbearbeitungsstand_seit: 2026-08-24\n---\n\n# Nur Body\n',
    )
  })

  it('respektiert CRLF-Zeilenenden bei ergaenzten Zeilen', () => {
    const markdown = '---\r\ntype: index\r\n---\r\n\r\nBody\r\n'
    const ergebnis = patchStandZeilen(markdown, PATCH)
    expect(ergebnis).toContain('bearbeitungsstand: abgenommen\r\nbearbeitungsstand_seit: 2026-08-24\r\n---')
    expect(ergebnis).toContain('type: index\r\n')
  })

  it('bricht laut ab, wenn der Frontmatter-Block nicht abgrenzbar ist', () => {
    expect(() => patchStandZeilen('---\ntype: index\nkein Ende', PATCH)).toThrow(/nicht eindeutig abgrenzbar/)
  })

  it('bearbeitungsstand trifft bearbeitungsstand_seit nicht (Key-Grenze am Doppelpunkt)', () => {
    const markdown = '---\nbearbeitungsstand_seit: 2026-08-18\n---\n\nBody\n'
    const ergebnis = patchStandZeilen(markdown, { bearbeitungsstand: 'erschlossen' })
    expect(ergebnis).toContain('bearbeitungsstand_seit: 2026-08-18')
    expect(ergebnis).toContain('bearbeitungsstand: erschlossen')
  })
})
