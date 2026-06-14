import { describe, it, expect } from 'vitest'
import { coerceToFacetType } from '@/lib/library-verification/value-coercion'

describe('coerceToFacetType', () => {
  it('normalisiert Komma-String zu string[] (changed)', () => {
    expect(coerceToFacetType('a, b ,c', 'string[]')).toEqual({ changed: true, value: ['a', 'b', 'c'] })
  })

  it('laesst sauberes string[] unveraendert', () => {
    expect(coerceToFacetType(['a', 'b'], 'string[]')).toEqual({ changed: false, value: ['a', 'b'] })
  })

  it('parst numerischen String zu number (changed)', () => {
    expect(coerceToFacetType('2024', 'number')).toEqual({ changed: true, value: 2024 })
  })

  it('akzeptiert vorhandene Zahl ohne Aenderung', () => {
    expect(coerceToFacetType(2024, 'integer-range')).toEqual({ changed: false, value: 2024 })
  })

  it('entfernt umschliessende Anfuehrungszeichen bei string', () => {
    expect(coerceToFacetType('"hi"', 'string')).toEqual({ changed: true, value: 'hi' })
  })

  it('wandelt Zahl in string (date/string)', () => {
    expect(coerceToFacetType(2024, 'string')).toEqual({ changed: true, value: '2024' })
  })

  it('koerziert boolean-Strings', () => {
    expect(coerceToFacetType('true', 'boolean')).toEqual({ changed: true, value: true })
    expect(coerceToFacetType(false, 'boolean')).toEqual({ changed: false, value: false })
  })

  it('liefert null bei echtem Typ-Konflikt (Objekt → string[])', () => {
    expect(coerceToFacetType({ a: 1 }, 'string[]')).toBeNull()
  })

  it('liefert null bei nicht-numerischem String → number', () => {
    expect(coerceToFacetType('abc', 'number')).toBeNull()
  })
})
