/**
 * Tests fuer die Auto-Injektion der Contract-Felder (ensureContractFields).
 * Basis-Felder + technische Pflichtfelder werden injiziert; inhaltliche
 * Pflichtfelder bleiben Sache der Redaktion (und werden vom Gate erzwungen).
 */

import { describe, expect, it } from 'vitest'
import { ensureContractFields } from '@/lib/templates/template-service-mongodb'
import { BASE_REQUIRED_FIELDS } from '@/lib/detail-view-types/base-fields'
import type { TemplateMetadataSchema } from '@/lib/templates/template-types'

function meta(fieldKeys: string[], detailViewType?: string): TemplateMetadataSchema {
  return {
    fields: fieldKeys.map((key) => ({ key, variable: key, description: 'x', rawValue: '' })),
    rawFrontmatter: '',
    detailViewType: detailViewType as TemplateMetadataSchema['detailViewType'],
  }
}

describe('ensureContractFields', () => {
  it('injiziert fehlende Basis-Felder', () => {
    const keys = ensureContractFields(meta(['category'], 'climateAction')).fields.map((f) => f.key)
    for (const base of BASE_REQUIRED_FIELDS) expect(keys).toContain(base)
  })

  it('injiziert technische Pflichtfelder des Typs (targetLanguage)', () => {
    const keys = ensureContractFields(meta(['category'], 'climateAction')).fields.map((f) => f.key)
    expect(keys).toContain('targetLanguage')
  })

  it('injiziert KEINE inhaltlichen Pflichtfelder (category bleibt redaktionell)', () => {
    const keys = ensureContractFields(meta([], 'climateAction')).fields.map((f) => f.key)
    expect(keys).not.toContain('category')
  })

  it('ist idempotent', () => {
    const first = ensureContractFields(meta([], 'book'))
    const second = ensureContractFields(first)
    expect(second.fields.length).toBe(first.fields.length)
  })

  it('injizierte Felder tragen eine nicht-leere Beschreibung', () => {
    const out = ensureContractFields(meta([], 'book'))
    for (const base of BASE_REQUIRED_FIELDS) {
      const field = out.fields.find((f) => f.key === base)
      expect(field?.description.trim().length).toBeGreaterThan(0)
    }
  })
})
