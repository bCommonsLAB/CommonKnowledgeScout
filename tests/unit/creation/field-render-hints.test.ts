/**
 * Charakter-Tests der Feld-Render-Hinweise (U3 / ADR-0003 O1). Pinnt das
 * Ist-Verhalten der aus edit-draft-step.tsx herausgelösten Heuristiken
 * (Label, Array-Eingabe) — verhaltenstreu.
 */

import { describe, expect, it } from 'vitest'
import {
  resolveFieldLabel,
  resolveFieldIsArrayInput,
  isWizardPickerField,
  isTextareaFieldByName,
  type FieldHintInput,
} from '@/lib/creation/field-render-hints'

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

describe('isWizardPickerField', () => {
  it('erkennt die Folge-Wizard-Picker-Felder', () => {
    expect(isWizardPickerField('wizard_testimonial_template_id')).toBe(true)
    expect(isWizardPickerField('wizard_finalize_template_id')).toBe(true)
  })

  it('normale Felder sind keine Picker', () => {
    expect(isWizardPickerField('title')).toBe(false)
    expect(isWizardPickerField('tags')).toBe(false)
  })
})

describe('isTextareaFieldByName', () => {
  it('summary + Felder mit Teilstring experience/insight/important -> true', () => {
    expect(isTextareaFieldByName('summary')).toBe(true)
    expect(isTextareaFieldByName('speaker_experience')).toBe(true)
    expect(isTextareaFieldByName('key_insight')).toBe(true)
    expect(isTextareaFieldByName('important_notes')).toBe(true)
  })

  it('Ist-Verhalten: Teilstring-Match ist case-sensitive (camelCase greift NICHT)', () => {
    // Dokumentiert: includes("experience") matcht "userExperience" nicht (großes E).
    expect(isTextareaFieldByName('userExperience')).toBe(false)
    expect(isTextareaFieldByName('keyInsight')).toBe(false)
  })

  it('normale Felder -> false', () => {
    expect(isTextareaFieldByName('title')).toBe(false)
    expect(isTextareaFieldByName('location')).toBe(false)
  })
})
