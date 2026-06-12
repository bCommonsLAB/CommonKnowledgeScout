/**
 * Char-Tests fuer die Inhaltstyp↔Vorlage-Konsistenzpruefung (F11).
 */

import { describe, it, expect } from 'vitest'
import { checkTemplateConsistency } from '@/lib/templates/template-consistency'

const knownTemplates = [
  { name: 'mein-buch-template', detailViewType: 'book', fieldKeys: ['title', 'language', 'targetLanguage', 'summary'] },
  { name: 'session-spezial', detailViewType: 'session', fieldKeys: ['title', 'language', 'targetLanguage'] },
  { name: 'ohne-typ', fieldKeys: ['title', 'language', 'targetLanguage'] },
  { name: 'lueckenhaft', detailViewType: 'climateAction', fieldKeys: ['title'] },
]

describe('checkTemplateConsistency', () => {
  it('leer = automatischer Standard → ok', () => {
    expect(checkTemplateConsistency({ templateName: '', viewType: 'book', knownTemplates }).level).toBe('ok')
    expect(checkTemplateConsistency({ templateName: undefined, viewType: 'book', knownTemplates }).level).toBe('ok')
  })

  it('passende Standard-Vorlage → ok, fremde → error', () => {
    expect(checkTemplateConsistency({ templateName: 'standard-book', viewType: 'book', knownTemplates }).level).toBe('ok')
    expect(checkTemplateConsistency({ templateName: 'standard-session', viewType: 'book', knownTemplates }).level).toBe('error')
  })

  it('Mongo-Vorlage mit passendem Typ → ok', () => {
    expect(checkTemplateConsistency({ templateName: 'mein-buch-template', viewType: 'book', knownTemplates }).level).toBe('ok')
  })

  it('detailViewType-Mismatch → error (harte Inkonsistenz)', () => {
    const result = checkTemplateConsistency({ templateName: 'session-spezial', viewType: 'book', knownTemplates })
    expect(result.level).toBe('error')
    expect(result.message).toContain('session')
  })

  it('fehlende Pflichtfelder → warn', () => {
    const result = checkTemplateConsistency({ templateName: 'lueckenhaft', viewType: 'climateAction', knownTemplates })
    expect(result.level).toBe('warn')
    expect(result.message).toContain('category')
  })

  it('Vorlage ohne deklarierten Typ → warn', () => {
    expect(checkTemplateConsistency({ templateName: 'ohne-typ', viewType: 'book', knownTemplates }).level).toBe('warn')
  })

  it('unbekannter Name → warn', () => {
    expect(checkTemplateConsistency({ templateName: 'gibt-es-nicht', viewType: 'book', knownTemplates }).level).toBe('warn')
  })
})
