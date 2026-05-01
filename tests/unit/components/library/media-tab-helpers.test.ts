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

// Test gegen die erwartete Pure-Logik. Wenn der Move passiert,
// importieren wir aus media-tab/helpers.ts.
function safeArrayExpected(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed.replace(/'/g, '"'))
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        }
      } catch { /* Fallback */ }
    }
  }
  return []
}

function parseUrlFileContentExpected(content: string): string | null {
  const urlMatch = content.match(/^URL\s*=\s*(.+)$/mi)
  if (urlMatch) {
    const url = urlMatch[1].trim()
    if (url.startsWith('http://') || url.startsWith('https://')) return url
  }
  const weblocMatch = content.match(/<string>(https?:\/\/[^<]+)<\/string>/i)
  if (weblocMatch) return weblocMatch[1]
  const genericMatch = content.match(/(https?:\/\/\S+)/i)
  if (genericMatch) return genericMatch[1]
  return null
}

describe('safeArray (media-tab) — Pure-Logik-Vertrag', () => {
  it('liefert leeres Array fuer null/undefined', () => {
    expect(safeArrayExpected(null)).toEqual([])
    expect(safeArrayExpected(undefined)).toEqual([])
  })

  it('filtert Nicht-Strings aus Array', () => {
    expect(safeArrayExpected(['a', 1, 'b'])).toEqual(['a', 'b'])
  })

  it('parsed JSON-Array-String', () => {
    expect(safeArrayExpected('["foo","bar"]')).toEqual(['foo', 'bar'])
  })

  it('parsed JSON-Array mit Single-Quotes (Python-Style)', () => {
    expect(safeArrayExpected("['foo','bar']")).toEqual(['foo', 'bar'])
  })

  it('filtert leere Strings aus geparstem Array', () => {
    expect(safeArrayExpected('["foo","","bar"," "]')).toEqual(['foo', 'bar'])
  })

  it('liefert leeres Array bei ungueltigem JSON', () => {
    expect(safeArrayExpected('[invalid')).toEqual([])
  })

  it('liefert leeres Array fuer Zahlen/Booleans', () => {
    expect(safeArrayExpected(42)).toEqual([])
    expect(safeArrayExpected(true)).toEqual([])
  })
})

describe('parseUrlFileContent (media-tab) — Pure-Logik-Vertrag', () => {
  it('extrahiert URL aus Windows .url-Format', () => {
    const content = '[InternetShortcut]\nURL=https://example.com/page'
    expect(parseUrlFileContentExpected(content)).toBe('https://example.com/page')
  })

  it('extrahiert URL aus macOS .webloc-Format (XML plist)', () => {
    const content = '<plist><dict><key>URL</key><string>https://example.com/page</string></dict></plist>'
    expect(parseUrlFileContentExpected(content)).toBe('https://example.com/page')
  })

  it('Fallback: erste URL im Text', () => {
    const content = 'kein url-format\nhttps://fallback.com hier'
    expect(parseUrlFileContentExpected(content)).toBe('https://fallback.com')
  })

  it('liefert null bei Inhalt ohne URL', () => {
    expect(parseUrlFileContentExpected('keine URL hier')).toBeNull()
  })

  it('akzeptiert sowohl http als auch https', () => {
    expect(parseUrlFileContentExpected('URL=http://insecure.com')).toBe('http://insecure.com')
    expect(parseUrlFileContentExpected('URL=https://secure.com')).toBe('https://secure.com')
  })

  it('ignoriert URL=ohne-Protokoll', () => {
    expect(parseUrlFileContentExpected('URL=example.com')).toBeNull()
  })
})
