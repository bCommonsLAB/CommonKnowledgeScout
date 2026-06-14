/**
 * Konsistenz-Anker fuer die Standard-Vorlagen (F11):
 * Jede im Sourcecode persistierte Standard-Vorlage MUSS exakt die
 * Default-Felder ihres Inhaltstyps aus der VIEW_TYPE_REGISTRY erzeugen.
 * Schlaegt dieser Test fehl, sind Registry und Vorlagen auseinandergelaufen.
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TEMPLATE_PREFIX,
  getDefaultTemplateNameForViewType,
  isBuiltinDefaultTemplateName,
  getBuiltinDefaultTemplate,
  resolveBuiltinDefaultTemplateByName,
  listBuiltinDefaultTemplates,
} from '@/lib/templates/default-templates'
import { validateTemplateForViewType } from '@/lib/detail-view-types/validation'
import { BASE_REQUIRED_FIELDS, missingBaseFields } from '@/lib/detail-view-types/base-fields'
import {
  DETAIL_VIEW_TYPES,
  getOptionalFields,
  getRequiredFields,
} from '@/lib/detail-view-types/registry'

describe('Standard-Vorlagen (default-templates)', () => {
  it('deckt fuer JEDEN Inhaltstyp alle Pflichtfelder der Registry ab', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      const template = getBuiltinDefaultTemplate(viewType)
      const fieldKeys = template.metadata.fields.map(f => f.key)
      const result = validateTemplateForViewType(fieldKeys, viewType)
      expect(result.isValid, `Pflichtfelder fehlen fuer ${viewType}: ${result.missingRequired.join(', ')}`).toBe(true)
    }
  })

  it('deckt fuer JEDEN Inhaltstyp die verbindlichen Basis-Felder ab', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      const template = getBuiltinDefaultTemplate(viewType)
      const fieldKeys = template.metadata.fields.map(f => f.key)
      const missing = missingBaseFields(fieldKeys)
      expect(missing, `Basis-Felder fehlen fuer ${viewType}: ${missing.join(', ')}`).toEqual([])
    }
  })

  it('hat fuer jedes Basis-Feld eine nicht-leere LLM-Beschreibung', () => {
    const template = getBuiltinDefaultTemplate('book')
    const byKey = Object.fromEntries(template.metadata.fields.map(f => [f.key, f]))
    for (const base of BASE_REQUIRED_FIELDS) {
      expect(byKey[base]?.description.trim().length, `Leere Beschreibung: ${base}`).toBeGreaterThan(0)
    }
  })

  it('enthaelt fuer JEDEN Inhaltstyp auch alle optionalen Registry-Felder', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      const template = getBuiltinDefaultTemplate(viewType)
      const fieldKeys = new Set(template.metadata.fields.map(f => f.key))
      for (const optional of getOptionalFields(viewType)) {
        expect(fieldKeys.has(optional), `Optionales Feld "${optional}" fehlt fuer ${viewType}`).toBe(true)
      }
    }
  })

  it('traegt den detailViewType im Frontmatter (selbst-beschreibend)', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      const template = getBuiltinDefaultTemplate(viewType)
      expect(template.metadata.detailViewType).toBe(viewType)
    }
  })

  it('hat fuer jedes LLM-Feld eine nicht-leere Beschreibung', () => {
    // Felder ohne Beschreibung werden vom Auto-Schema gefiltert und
    // wuerden vom LLM nicht befuellt.
    for (const viewType of DETAIL_VIEW_TYPES) {
      const template = getBuiltinDefaultTemplate(viewType)
      const llmFields = template.metadata.fields.filter(f => f.key !== 'detailViewType')
      const required = new Set([...getRequiredFields(viewType), ...getOptionalFields(viewType)])
      for (const field of llmFields) {
        if (!required.has(field.key)) continue
        expect(field.description.trim().length, `Leere Beschreibung: ${viewType}.${field.key}`).toBeGreaterThan(0)
      }
    }
  })

  it('Namen und Resolver sind konsistent', () => {
    expect(getDefaultTemplateNameForViewType('book')).toBe('standard-book')
    expect(isBuiltinDefaultTemplateName('standard-book')).toBe(true)
    expect(isBuiltinDefaultTemplateName('Standard-Book')).toBe(true)
    expect(isBuiltinDefaultTemplateName('standard-unbekannt')).toBe(false)
    expect(isBuiltinDefaultTemplateName('pdfanalyse')).toBe(false)
    expect(isBuiltinDefaultTemplateName('')).toBe(false)
    expect(isBuiltinDefaultTemplateName(undefined)).toBe(false)

    const resolved = resolveBuiltinDefaultTemplateByName('standard-climateaction')
    expect(resolved?.metadata.detailViewType).toBe('climateAction')
    expect(resolveBuiltinDefaultTemplateByName('irgendwas')).toBeNull()
  })

  it('listet genau eine Standard-Vorlage pro Inhaltstyp', () => {
    const all = listBuiltinDefaultTemplates()
    expect(all).toHaveLength(DETAIL_VIEW_TYPES.length)
    const names = all.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) {
      expect(name.startsWith(DEFAULT_TEMPLATE_PREFIX)).toBe(true)
    }
  })

  it('hat einen Systemprompt mit Journalist-Framing', () => {
    const template = getBuiltinDefaultTemplate('book')
    expect(template.systemprompt).toContain('Journalist')
  })
})
