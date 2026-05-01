// @vitest-environment node

/**
 * Characterization Tests fuer Pure-Helper aus media-tab.tsx
 * (Welle 3-II-c, Schritt 1 — Sicherheitsnetz vor Helper-Extract).
 *
 * Fixiert das Verhalten von zwei Pure-Helpers:
 * - `safeArray` — robuste Konvertierung in String-Array
 * - `parseUrlFileContent` — URL aus .url/.webloc-Dateien extrahieren
 *
 * Diese Tests bilden das Sicherheitsnetz fuer den Helper-Extract in
 * Schritt 3/5.
 */

import { describe, it, expect } from 'vitest'
import { safeArray, parseUrlFileContent } from '@/components/library/media-tab/helpers'

// Hinweis: 'safeArray' fuer Strings, die NICHT mit [ beginnen, gibt ein
// Array mit dem getrimmten String zurueck (Bestands-Verhalten — siehe
// helpers.ts). Dies ist eine bewusste Eigenheit ggue. safeParseStringArray
// aus job-report-tab.

describe('safeArray (media-tab/helpers) — Pure-Logik-Vertrag', () => {
  it('liefert leeres Array fuer null/undefined', () => {
    expect(safeArray(null)).toEqual([])
    expect(safeArray(undefined)).toEqual([])
  })

  it('filtert Nicht-Strings aus Array', () => {
    expect(safeArray(['a', 1, 'b'])).toEqual(['a', 'b'])
  })

  it('parsed JSON-Array-String', () => {
    expect(safeArray('["foo","bar"]')).toEqual(['foo', 'bar'])
  })

  it('parsed JSON-Array mit Single-Quotes (Python-Style)', () => {
    expect(safeArray("['foo','bar']")).toEqual(['foo', 'bar'])
  })

  it('filtert leere Strings aus geparstem Array', () => {
    expect(safeArray('["foo","","bar"," "]')).toEqual(['foo', 'bar'])
  })

  it('Fallback bei String ohne []-Brackets: Array mit Einzelwert', () => {
    expect(safeArray('foo,bar')).toEqual(['foo,bar'])
  })

  it('liefert leeres Array fuer Zahlen/Booleans', () => {
    expect(safeArray(42)).toEqual([])
    expect(safeArray(true)).toEqual([])
  })
})

describe('parseUrlFileContent (media-tab/helpers) — Pure-Logik-Vertrag', () => {
  it('extrahiert URL aus Windows .url-Format', () => {
    const content = '[InternetShortcut]\nURL=https://example.com/page'
    expect(parseUrlFileContent(content)).toBe('https://example.com/page')
  })

  it('extrahiert URL aus macOS .webloc-Format (XML plist)', () => {
    const content = '<plist><dict><key>URL</key><string>https://example.com/page</string></dict></plist>'
    expect(parseUrlFileContent(content)).toBe('https://example.com/page')
  })

  it('Fallback: erste URL im Text', () => {
    const content = 'kein url-format\nhttps://fallback.com hier'
    expect(parseUrlFileContent(content)).toBe('https://fallback.com')
  })

  it('liefert null bei Inhalt ohne URL', () => {
    expect(parseUrlFileContent('keine URL hier')).toBeNull()
  })

  it('akzeptiert sowohl http als auch https', () => {
    expect(parseUrlFileContent('URL=http://insecure.com')).toBe('http://insecure.com')
    expect(parseUrlFileContent('URL=https://secure.com')).toBe('https://secure.com')
  })

  it('ignoriert URL=ohne-Protokoll', () => {
    expect(parseUrlFileContent('URL=example.com')).toBeNull()
  })
})
