/**
 * @fileoverview Unit-Tests: Gliederung ohne Body (Wunschliste 6, B1) und
 * Groessenhinweis beim Schreiben einer BERICHT.md (B2).
 */

import { describe, expect, it } from 'vitest'
import { findeAbschnitt } from '@/lib/mcp/storage/bereich'
import { berichtHinweis } from '@/lib/mcp/storage/bericht-hinweis'
import { baueGliederung } from '@/lib/mcp/storage/gliederung'

const BERICHT = [
  '---', 'type: bericht', 'rolle: anwendung', '# nur ein YAML-Kommentar', '---', '',
  '# Titel', '', 'Vorspann.', '',
  '## Status', 'Zeile mit Umlaut ä', '',
  '## Nächste Schritte', '- [ ] eins', '- [x] erledigt', '### Später', '- [ ] zwei', '',
  '## Muster', '```markdown', '# Im Codeblock', '```', '',
].join('\n')

describe('baueGliederung', () => {
  const gliederung = baueGliederung(BERICHT)
  const nach = (titel: string) => gliederung.eintraege.find((e) => e.ueberschrift === titel)

  it('liefert Ebene, Wortlaut und 1-basierte Zeilenbereiche — keinen Body', () => {
    expect(nach('Status')).toMatchObject({ ebene: 2, vonZeile: 11, bisZeile: 13 })
    // Die Scheinueberschrift im Codeblock (Zeile 22) beendet den Abschnitt —
    // so schneiden auch `abschnitt` und `abschnitt_ersetzen`.
    expect(nach('Titel')).toMatchObject({ ebene: 1, vonZeile: 7, bisZeile: 21 })
    expect(JSON.stringify(gliederung)).not.toContain('Vorspann')
  })

  it('Bytes zaehlen UTF-8, Unterabschnitte eingeschlossen', () => {
    expect(nach('Status')?.bytes).toBe(Buffer.byteLength('## Status\nZeile mit Umlaut ä\n', 'utf-8'))
    expect(nach('Nächste Schritte')?.offenePunkte).toBe(2)
    expect(nach('Später')?.offenePunkte).toBe(1)
  })

  it('dieselbe Grenze wie Lesen und Ersetzen (findeAbschnitt)', () => {
    for (const eintrag of gliederung.eintraege.filter((e) => !e.keineEchteUeberschrift)) {
      const grenzen = findeAbschnitt(BERICHT, eintrag.ueberschrift)
      expect({ von: grenzen.start + 1, bis: grenzen.ende }).toEqual({ von: eintrag.vonZeile, bis: eintrag.bisZeile })
    }
  })

  it('Scheinueberschriften in Frontmatter und Codeblock sind ausgewiesen, nicht verschwiegen', () => {
    expect(nach('nur ein YAML-Kommentar')?.keineEchteUeberschrift).toBe(true)
    expect(nach('Im Codeblock')?.keineEchteUeberschrift).toBe(true)
    expect(nach('Status')?.keineEchteUeberschrift).toBeUndefined()
  })

  it('Datei ohne Ueberschrift: leere Liste, Vorspann = alles', () => {
    expect(baueGliederung('nur Text\nzwei Zeilen')).toEqual({ zeilenGesamt: 2, vorspannBytes: 20, eintraege: [] })
  })
})

describe('berichtHinweis', () => {
  const max = { anwendung: 100, plattform: null }
  const lang = `---\nrolle: anwendung\n---\n${'x'.repeat(200)}`

  it('schweigt bei allem, was keine BERICHT.md ist', () => {
    expect(berichtHinweis({ pfad: 'a/Korrespondenz.md', inhaltNachher: lang, berichtMaxBytes: max })).toEqual({})
  })

  it('nennt Groesse, Schwelle der Rolle und Ueberschreitung', () => {
    expect(berichtHinweis({ pfad: 'a/BERICHT.md', inhaltNachher: lang, berichtMaxBytes: max }))
      .toEqual({ groesseNachher: Buffer.byteLength(lang, 'utf-8'), schwelle: 100, schwelleUeberschritten: true })
  })

  it('ohne Schwelle (Plattform bzw. nichts konfiguriert): schwelle null, nie ueberschritten', () => {
    const plattform = lang.replace('anwendung', 'plattform')
    expect(berichtHinweis({ pfad: 'BERICHT.md', inhaltNachher: plattform, berichtMaxBytes: max })).toMatchObject({ schwelle: null, schwelleUeberschritten: false })
    expect(berichtHinweis({ pfad: 'BERICHT.md', inhaltNachher: lang, berichtMaxBytes: undefined })).toMatchObject({ schwelle: null, schwelleUeberschritten: false })
  })

  it('neuer ##-Abschnitt per abschnitt_einfuegen bekommt die Rueckfrage — eine Tabellenzeile nicht', () => {
    const einfuegen = { art: 'abschnitt_einfuegen' as const, ueberschrift: 'Status', position: 'nach' as const, inhalt: '## Aus der Korrespondenz — KW 38\n\nText' }
    expect(berichtHinweis({ pfad: 'BERICHT.md', inhaltNachher: lang, berichtMaxBytes: max, modi: [einfuegen] }).hinweis).toContain('Ereignisnotiz')
    const absatz = { ...einfuegen, inhalt: 'nur ein Absatz' }
    expect(berichtHinweis({ pfad: 'BERICHT.md', inhaltNachher: lang, berichtMaxBytes: max, modi: [absatz] }).hinweis).toBeUndefined()
  })
})
