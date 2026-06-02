/**
 * Tests für B6 — inhaltliche Pflichtfelder (content-fields.ts).
 * Sichert die Erfolgskriterien aus docs/wizards/abnahme-inbox-plan.md:
 * inhaltliche Pflichtfelder = requiredFields ohne technische Felder.
 */

import { describe, expect, it } from 'vitest'
import {
  contentRequiredFields,
  isTechnicalField,
  TECHNICAL_REQUIRED_FIELDS,
} from '@/lib/detail-view-types/content-fields'
import { DETAIL_VIEW_TYPES, getRequiredFields } from '@/lib/detail-view-types/registry'

describe('isTechnicalField', () => {
  it('erkennt technische Felder', () => {
    for (const f of ['language', 'targetLanguage', 'slug', 'docType']) {
      expect(isTechnicalField(f)).toBe(true)
    }
  })
  it('inhaltliche Felder sind nicht technisch', () => {
    for (const f of ['title', 'author_name', 'summary', 'modell']) {
      expect(isTechnicalField(f)).toBe(false)
    }
  })
})

describe('contentRequiredFields', () => {
  it.each([
    ['book', ['title']],
    ['session', ['title']],
    ['testimonial', ['title', 'author_name']],
    ['blog', ['title']],
    ['climateAction', ['title', 'category']],
    ['divaDocument', ['title', 'dokumentTyp', 'produktname', 'lieferant']],
    ['refurbedDevice', ['title', 'modell']],
    ['divaTexture', ['title']],
  ] as const)('%s liefert die inhaltlichen Pflichtfelder', (viewType, expected) => {
    expect(contentRequiredFields(viewType)).toEqual([...expected])
  })

  it('schließt technische Felder bei JEDEM ViewType aus', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      const content = contentRequiredFields(viewType)
      for (const technical of TECHNICAL_REQUIRED_FIELDS) {
        expect(content).not.toContain(technical)
      }
    }
  })

  it('ist eine Teilmenge der Registry-requiredFields (nichts erfunden)', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      const required = new Set(getRequiredFields(viewType))
      for (const field of contentRequiredFields(viewType)) {
        expect(required.has(field)).toBe(true)
      }
    }
  })

  it('unbekannter oder fehlender ViewType → leere Liste (kein stiller Fehler)', () => {
    expect(contentRequiredFields('gibtsnicht')).toEqual([])
    expect(contentRequiredFields(undefined)).toEqual([])
  })
})
