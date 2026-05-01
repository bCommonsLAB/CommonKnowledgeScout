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
import { safeParseStringArray } from '@/components/library/job-report-tab/helpers'

describe('safeParseStringArray (job-report-tab/helpers) — Pure-Logik-Vertrag', () => {
  it('liefert undefined fuer null/undefined/Zahl/Boolean', () => {
    expect(safeParseStringArray(null)).toBeUndefined()
    expect(safeParseStringArray(undefined)).toBeUndefined()
    expect(safeParseStringArray(42)).toBeUndefined()
    expect(safeParseStringArray(true)).toBeUndefined()
  })

  it('filtert Nicht-Strings aus echten Arrays heraus', () => {
    expect(safeParseStringArray(['a', 1, 'b', null, 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('parsed JSON-String-Array-Notation', () => {
    expect(safeParseStringArray('["foo","bar"]')).toEqual(['foo', 'bar'])
  })

  it('parsed JSON-String mit Whitespace', () => {
    expect(safeParseStringArray('  ["foo","bar"]  ')).toEqual(['foo', 'bar'])
  })

  it('liefert undefined bei ungueltigem JSON', () => {
    expect(safeParseStringArray('[invalid json')).toBeUndefined()
  })

  it('liefert undefined bei JSON, das kein Array ist', () => {
    expect(safeParseStringArray('{"a":1}')).toBeUndefined()
  })

  it('liefert undefined fuer Strings, die nicht mit [ beginnen', () => {
    expect(safeParseStringArray('foo,bar')).toBeUndefined()
  })

  it('liefert leeres Array fuer leere Arrays', () => {
    expect(safeParseStringArray([])).toEqual([])
    expect(safeParseStringArray('[]')).toEqual([])
  })
})
