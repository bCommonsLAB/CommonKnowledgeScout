/**
 * Tests fuer das Template-Integritaets-Gate (template-integrity.ts).
 * Sichert den Konsistenz-Contract an den Schreib-Engpaessen: gueltiger
 * detailViewType + Abdeckung von Pflicht- und Basis-Feldern.
 */

import { describe, expect, it } from 'vitest'
import { validateTemplateIntegrity } from '@/lib/templates/template-integrity'
import { BASE_REQUIRED_FIELDS } from '@/lib/detail-view-types/base-fields'

// Vollstaendiger, gueltiger Feldsatz fuer 'session' (Pflicht: title/language/targetLanguage)
const VALID_SESSION_FIELDS = [...BASE_REQUIRED_FIELDS, 'targetLanguage']

describe('validateTemplateIntegrity', () => {
  it('akzeptiert eine Vorlage mit gueltigem Typ + allen Pflicht- und Basis-Feldern', () => {
    const r = validateTemplateIntegrity({
      fieldKeys: VALID_SESSION_FIELDS,
      detailViewType: 'session',
      templateName: 'mein-session',
    })
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('lehnt eine Vorlage ohne detailViewType ab', () => {
    const r = validateTemplateIntegrity({ fieldKeys: VALID_SESSION_FIELDS })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('kein detailViewType')
  })

  it('lehnt einen unbekannten detailViewType ab', () => {
    const r = validateTemplateIntegrity({ fieldKeys: VALID_SESSION_FIELDS, detailViewType: 'gibtsnicht' })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('unbekannter detailViewType')
  })

  it('meldet fehlende Basis-Felder als Fehler', () => {
    const r = validateTemplateIntegrity({
      fieldKeys: ['title', 'language', 'targetLanguage'],
      detailViewType: 'session',
    })
    expect(r.ok).toBe(false)
    const msg = r.errors.join(' ')
    expect(msg).toContain('Basis-Felder')
    expect(msg).toContain('date')
    expect(msg).toContain('tags')
  })

  it('meldet fehlende typ-spezifische Pflichtfelder als Fehler (z.B. category bei climateAction)', () => {
    const r = validateTemplateIntegrity({
      fieldKeys: [...BASE_REQUIRED_FIELDS, 'targetLanguage'],
      detailViewType: 'climateAction',
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('category')
  })

  it('fehlende empfohlene (optionale) Felder sind nur Warnungen, kein Fehler', () => {
    const r = validateTemplateIntegrity({
      fieldKeys: VALID_SESSION_FIELDS,
      detailViewType: 'session',
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings.join(' ')).toContain('empfohlene Felder')
  })
})
