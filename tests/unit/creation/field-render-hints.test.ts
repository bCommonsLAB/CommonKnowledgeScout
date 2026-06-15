/**
 * Charakter-Tests der Feld-Render-Hinweise (U3 / ADR-0003 O1). Pinnt das
 * Ist-Verhalten der aus edit-draft-step.tsx herausgelösten Heuristiken
 * (Label, Array-Eingabe) — verhaltenstreu.
 */

import { describe, expect, it } from 'vitest'
import { resolveFieldLabel, resolveFieldIsArrayInput, type FieldHintInput } from '@/lib/creation/field-render-hints'

const fields: FieldHintInput[] = [
  { key: 'title', variable: 'title', description: 'Titel des Events. Mehr Details hier.' },
  { key: 'summary', variable: 'summary' },
  { key: 'tags', variable: 'tags', rawValue: '{{tags|Schlagworte}}' },
  { key: 'topics', variable: 'topics' },
  { key: 'speakerList', variable: 'speakerList', rawValue: '{{speakerList|Array von Sprechern}}' },
  { key: 'location', variable: 'location', description: '' },
]

describe('resolveFieldLabel', () => {
  it('nutzt den ersten Satz der Beschreibung', () => {
    expect(resolveFieldLabel('title', fields)).toBe('Titel des Events')
  })

  it('fällt ohne Beschreibung auf die Label-Map zurück', () => {
    expect(resolveFieldLabel('summary', fields)).toBe('Zusammenfassung')
    expect(resolveFieldLabel('topics', fields)).toBe('Themen')
  })

  it('leere Beschreibung -> Label-Map (location)', () => {
    expect(resolveFieldLabel('location', fields)).toBe('Ort')
  })

  it('unbekannter Feldname -> Key selbst', () => {
    expect(resolveFieldLabel('gibtsNicht', fields)).toBe('gibtsNicht')
  })
})

describe('resolveFieldIsArrayInput', () => {
  it('rawValue enthält "Array" -> true', () => {
    expect(resolveFieldIsArrayInput('speakerList', fields)).toBe(true)
  })

  it('bekannter Array-Feldname -> true (auch ohne rawValue-Hinweis)', () => {
    expect(resolveFieldIsArrayInput('tags', fields)).toBe(true)
    expect(resolveFieldIsArrayInput('topics', fields)).toBe(true)
  })

  it('normales Feld -> false', () => {
    expect(resolveFieldIsArrayInput('title', fields)).toBe(false)
    expect(resolveFieldIsArrayInput('summary', fields)).toBe(false)
  })

  it('unbekanntes Feld (kein Schema-Feld) -> false', () => {
    expect(resolveFieldIsArrayInput('gibtsNicht', fields)).toBe(false)
  })
})
