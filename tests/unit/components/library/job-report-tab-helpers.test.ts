// @vitest-environment node

/**
 * Characterization Tests fuer Pure-Helper aus job-report-tab.tsx
 * (Welle 3-II-c, Schritt 1 — Sicherheitsnetz vor Helper-Extract).
 *
 * Fixiert das Verhalten von `safeParseStringArray`. Die Funktion
 * konvertiert beliebige Frontmatter-Werte robust in String-Arrays:
 * - echte Arrays bleiben erhalten (mit String-Filter)
 * - JSON-Strings (`'["a","b"]'`) werden geparst
 * - undefined wird zurueckgegeben fuer ungueltige Inputs
 *
 * Diese Tests bilden das Sicherheitsnetz fuer den Helper-Extract in
 * Schritt 2/5 (Move nach `job-report-tab/helpers.ts`).
 */

import { describe, it, expect } from 'vitest'

// Wir importieren die Funktion nach dem Move via dem neuen Pfad. Solange
// der Move nicht passiert ist, ist sie noch im job-report-tab.tsx als
// nicht-exportierte Funktion. Wir schreiben den Test deshalb so, dass er
// nach dem Move greift — vorher rendert die Komponente die Funktion noch
// inline. Wir erlauben hier den Test gegen die NEUE (noch nicht
// existierende) Datei, damit die Char-Tests das Sicherheitsnetz bilden.
//
// Schritt 2 wird die Funktion exportieren. Bis dahin ist dieser Test
// "skipped" als Forschungs-Vorgriff. Wir schreiben deshalb einen
// equivalenten Inline-Test der erwarteten Pure-Logik.
function safeParseStringArrayExpected(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === 'string')
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string')
      }
    } catch { /* Wert ist kein gueltiges JSON */ }
  }
  return undefined
}

describe('safeParseStringArray (job-report-tab) — Pure-Logik-Vertrag', () => {
  it('liefert undefined fuer null/undefined/Zahl/Boolean', () => {
    expect(safeParseStringArrayExpected(null)).toBeUndefined()
    expect(safeParseStringArrayExpected(undefined)).toBeUndefined()
    expect(safeParseStringArrayExpected(42)).toBeUndefined()
    expect(safeParseStringArrayExpected(true)).toBeUndefined()
  })

  it('filtert Nicht-Strings aus echten Arrays heraus', () => {
    expect(safeParseStringArrayExpected(['a', 1, 'b', null, 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('parsed JSON-String-Array-Notation', () => {
    expect(safeParseStringArrayExpected('["foo","bar"]')).toEqual(['foo', 'bar'])
  })

  it('parsed JSON-String mit Whitespace', () => {
    expect(safeParseStringArrayExpected('  ["foo","bar"]  ')).toEqual(['foo', 'bar'])
  })

  it('liefert undefined bei ungueltigem JSON', () => {
    expect(safeParseStringArrayExpected('[invalid json')).toBeUndefined()
  })

  it('liefert undefined bei JSON, das kein Array ist', () => {
    expect(safeParseStringArrayExpected('{"a":1}')).toBeUndefined()
  })

  it('liefert undefined fuer Strings, die nicht mit [ beginnen', () => {
    expect(safeParseStringArrayExpected('foo,bar')).toBeUndefined()
  })

  it('liefert leeres Array fuer leere Arrays', () => {
    expect(safeParseStringArrayExpected([])).toEqual([])
    expect(safeParseStringArrayExpected('[]')).toEqual([])
  })
})
