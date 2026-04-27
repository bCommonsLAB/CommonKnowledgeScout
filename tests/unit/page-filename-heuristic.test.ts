import { describe, expect, it } from 'vitest'

import {
  deriveSpeakingPageFilename,
  deriveSpeakingSuffix,
} from '@/lib/pdf/page-filename-heuristic'

describe('page-filename-heuristic', () => {
  describe('deriveSpeakingSuffix', () => {
    it('extrahiert Suffix aus erster Markdown-Headline (h1)', () => {
      const md = '# GADERFORM PREISLISTE\n\nText...'
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('gaderform-preisliste')
    })

    it('extrahiert Suffix aus h2/h3', () => {
      const h2 = '## Inhaltsverzeichnis\n\nNoch mehr Text'
      expect(deriveSpeakingSuffix({ pageMarkdown: h2, maxSuffixLength: 40 })).toBe('inhaltsverzeichnis')

      const h3 = '### Bett Conform Lisbon\n\nDetails ...'
      expect(deriveSpeakingSuffix({ pageMarkdown: h3, maxSuffixLength: 40 })).toBe('bett-conform-lisbon')
    })

    it('faellt auf erste sinnvolle Textzeile zurueck, wenn keine Headline da ist', () => {
      const md = 'Konditionen und Liefertermine fuer Haendler\n\nweiterer Text'
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('konditionen-und-liefertermine-fuer')
    })

    it('bevorzugt ALL-CAPS-Single-Line-Headline ueber Tabellen/Bilder/Zahlen', () => {
      // OCR-Output (Mistral) ohne Markdown-Headline:
      // "GADERFORM" als Brand-Marker am Seitenanfang soll bevorzugt werden,
      // NICHT die spaetere mehrwoertige Bildunterschrift.
      // Vorgelagerte Strukturzeilen (Pipe/Bild/Zahl) duerfen die ALL-CAPS-Erkennung
      // nicht blockieren, solange sie noch innerhalb des Scan-Limits stehen.
      const md = [
        '| Spalte | Wert |',
        '![Logo](logo.png)',
        '42',
        'GADERFORM',
        'Hier kommt der eigentliche erste Satz mit mehreren Worten',
      ].join('\n')
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('gaderform')
    })

    it('erkennt ALL-CAPS-Single-Word-Brand-Marker (z.B. GARDENA)', () => {
      // Realer Fall aus page_007 der Gaderform-Preisliste: "GARDENA" als alleinige
      // Plain-Text-Headline am Seitenanfang.
      const md = ['GARDENA', '', 'Loden-Stoffe ab Werk fuer Polsterung'].join('\n')
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('gardena')
    })

    it('erkennt ALL-CAPS-Headline mit bis zu 3 Worten', () => {
      const md = ['GARDENA NIGHT EDITION', '', 'Beschreibungstext folgt'].join('\n')
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('gardena-night-edition')
    })

    it('verwirft ALL-CAPS-Zeilen mit mehr als 3 Worten (kein Brand-Marker)', () => {
      // 4-Wort-CAPS-Zeile: ALL-CAPS-Regel greift nicht (zu lang). Da die Zeile
      // aber 4 Worte hat, erfuellt sie den 3-Worte-Fallback und gewinnt dort -
      // weil sie vor dem naechsten Satz steht. Wir wollen hier explizit pruefen,
      // dass die Zeile NICHT ueber die ALL-CAPS-Stufe ausgewaehlt wird; das Ergebnis
      // ist trotzdem dieselbe Zeile, aber ueber Stufe 3.
      const md = ['GARDENA NIGHT SUPER EDITION', '', 'Erster Satz mit mehreren Worten hier'].join(
        '\n'
      )
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('gardena-night-super-edition')
    })

    it('verwirft Mixed-Case-Single-Lines (kein Brand-Marker)', () => {
      // "Gaderform" ist Brand, aber NICHT ALL-CAPS -> der Fallback muss greifen.
      // Der dann ausgewaehlte Satz wird auf maxSuffixLength=40 gekuerzt
      // ('hier-folgt-ein-vollstaendiger-satz-mit' = 38 Zeichen, passt komplett).
      const md = ['Gaderform', '', 'Hier folgt ein vollstaendiger Satz mit mehreren Worten'].join(
        '\n'
      )
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('hier-folgt-ein-vollstaendiger-satz-mit')
    })

    it('verwirft sehr kurze ALL-CAPS-Tokens (<3 Buchstaben)', () => {
      // "AB" ist zu kurz -> kein verlaesslicher Brand-Marker. Fallback muss greifen.
      const md = ['AB', '', 'Hier folgt ein vollstaendiger Satz mit mehreren Worten'].join('\n')
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('hier-folgt-ein-vollstaendiger-satz-mit')
    })

    it('Markdown-Headline gewinnt vor ALL-CAPS-Zeile', () => {
      // Wenn beides vorhanden ist, behaelt die explizite Markdown-Headline Vorrang.
      const md = ['# Modell Conform Lisbon', '', 'GARDENA', '', 'Weiterer Text'].join('\n')
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('modell-conform-lisbon')
    })

    it('liefert leeren Suffix bei leerer Seite', () => {
      expect(deriveSpeakingSuffix({ pageMarkdown: '', maxSuffixLength: 40 })).toBe('')
      expect(deriveSpeakingSuffix({ pageMarkdown: '\n\n   \n\n', maxSuffixLength: 40 })).toBe('')
    })

    it('truncates am Wort-Boundary (Bindestrich)', () => {
      // langer Text, dessen normalisiertes Ergebnis das Limit ueberschreitet
      const md = '# Sehr langer Titel mit vielen Woertern und exotisch-langen Bezeichnungen'
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 30 })
      expect(suffix.length).toBeLessThanOrEqual(30)
      // Endet nicht mitten im Wort
      expect(suffix.endsWith('-')).toBe(false)
      expect(suffix).toMatch(/^sehr-langer-titel-mit/)
    })

    it('normalisiert Umlaute und Sonderzeichen ueber toSafeFolderName', () => {
      // toSafeFolderName entfernt Diakritika (ä/ö/ü -> a/o/u) via NFKD;
      // ß bleibt jedoch erhalten und wird im non-ASCII-Filter zu '-' (Sonderzeichen).
      // Wichtig hier: Umlaute werden ASCII, Sonderzeichen werden zu Bindestrichen.
      const md = '# Ueber die Groesse & Vielfalt'
      const suffix = deriveSpeakingSuffix({ pageMarkdown: md, maxSuffixLength: 40 })
      expect(suffix).toBe('ueber-die-groesse-vielfalt')
    })
  })

  describe('deriveSpeakingPageFilename', () => {
    it('liefert page_NNN__<suffix>.<ext> bei vorhandenem Inhalt', () => {
      expect(
        deriveSpeakingPageFilename({
          pageNumber: 1,
          pageMarkdown: '# GADERFORM PREISLISTE',
          imageExtension: 'png',
        })
      ).toBe('page_001__gaderform-preisliste.png')
    })

    it('liefert page_NNN.<ext> ohne Suffix bei leerer Seite', () => {
      expect(
        deriveSpeakingPageFilename({
          pageNumber: 7,
          pageMarkdown: '',
          imageExtension: 'jpeg',
        })
      ).toBe('page_007.jpeg')
    })

    it('normalisiert jpg auf jpeg', () => {
      expect(
        deriveSpeakingPageFilename({
          pageNumber: 12,
          pageMarkdown: '## Inhalt',
          imageExtension: 'jpg',
        })
      ).toMatch(/^page_012__inhalt\.jpeg$/)
    })

    it('paddet Seitenzahlen auf 3 Stellen', () => {
      expect(
        deriveSpeakingPageFilename({
          pageNumber: 36,
          pageMarkdown: '',
          imageExtension: 'png',
        })
      ).toBe('page_036.png')
      expect(
        deriveSpeakingPageFilename({
          pageNumber: 100,
          pageMarkdown: '',
          imageExtension: 'png',
        })
      ).toBe('page_100.png')
    })
  })
})
