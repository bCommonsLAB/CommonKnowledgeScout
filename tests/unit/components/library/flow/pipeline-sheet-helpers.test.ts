// @vitest-environment node

/**
 * Characterization Tests fuer Pure-Helper + Konstanten aus
 * flow/pipeline-sheet.tsx (Welle 3-II-d, Schritt 1).
 */

import { describe, it, expect } from 'vitest'
import { isNonEmptyString } from '@/components/library/flow/pipeline-sheet/helpers'

describe('isNonEmptyString (pipeline-sheet) — Pure-Logik-Vertrag', () => {
  it('liefert true fuer nicht-leeren String', () => {
    expect(isNonEmptyString('hello')).toBe(true)
    expect(isNonEmptyString('a')).toBe(true)
  })

  it('liefert false fuer leeren String', () => {
    expect(isNonEmptyString('')).toBe(false)
  })

  it('liefert false fuer Whitespace-only-String', () => {
    expect(isNonEmptyString('   ')).toBe(false)
    expect(isNonEmptyString('\n\t')).toBe(false)
  })

  it('liefert false fuer null/undefined', () => {
    expect(isNonEmptyString(null)).toBe(false)
    expect(isNonEmptyString(undefined)).toBe(false)
  })

  it('liefert false fuer Zahlen, Booleans, Objekte, Arrays', () => {
    expect(isNonEmptyString(42)).toBe(false)
    expect(isNonEmptyString(true)).toBe(false)
    expect(isNonEmptyString({})).toBe(false)
    expect(isNonEmptyString([])).toBe(false)
  })

  it('akzeptiert String mit fuehrendem/trailing Whitespace, wenn Inhalt vorhanden', () => {
    expect(isNonEmptyString('  hello  ')).toBe(true)
  })
})
