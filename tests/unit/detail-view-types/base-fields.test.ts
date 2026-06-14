/**
 * Tests fuer den Basis-Feld-Contract (base-fields.ts).
 * Sichert den gemeinsamen Nenner jeder Library ("Erweiterter Kern",
 * Entscheidung 2026-06-14): title, date, authors, language, source, tags.
 */

import { describe, expect, it } from 'vitest'
import {
  BASE_REQUIRED_FIELDS,
  BASE_FACET_FIELDS,
  BASE_FACET_DEFS,
  isBaseRequiredField,
  isBaseFacetField,
  missingBaseFields,
} from '@/lib/detail-view-types/base-fields'

describe('BASE_REQUIRED_FIELDS', () => {
  it('ist genau der "Erweiterte Kern"', () => {
    expect([...BASE_REQUIRED_FIELDS]).toEqual([
      'title',
      'date',
      'authors',
      'language',
      'source',
      'tags',
    ])
  })

  it('enthaelt keine Duplikate', () => {
    expect(new Set(BASE_REQUIRED_FIELDS).size).toBe(BASE_REQUIRED_FIELDS.length)
  })
})

describe('BASE_FACET_FIELDS', () => {
  it('ist eine Teilmenge der Pflichtfelder (nichts erfunden)', () => {
    const required = new Set<string>(BASE_REQUIRED_FIELDS)
    for (const f of BASE_FACET_FIELDS) {
      expect(required.has(f)).toBe(true)
    }
  })

  it('laesst die reinen Pflicht-aber-nicht-Facetten-Felder (title, language) aus', () => {
    expect(BASE_FACET_FIELDS).not.toContain('title')
    expect(BASE_FACET_FIELDS).not.toContain('language')
  })
})

describe('BASE_FACET_DEFS', () => {
  it('deckt genau die Basis-Facetten ab und ist immer mandatory', () => {
    expect(BASE_FACET_DEFS.map((d) => d.metaKey)).toEqual([...BASE_FACET_FIELDS])
    for (const def of BASE_FACET_DEFS) {
      expect(def.mandatory).toBe(true)
      expect(typeof def.label).toBe('string')
    }
  })

  it('typisiert Array-Felder als string[] und das Datum als date', () => {
    const byKey = Object.fromEntries(BASE_FACET_DEFS.map((d) => [d.metaKey, d]))
    expect(byKey.authors.type).toBe('string[]')
    expect(byKey.tags.type).toBe('string[]')
    expect(byKey.date.type).toBe('date')
    expect(byKey.source.type).toBe('string')
  })
})

describe('isBaseRequiredField / isBaseFacetField', () => {
  it('erkennt Pflichtfelder', () => {
    expect(isBaseRequiredField('title')).toBe(true)
    expect(isBaseRequiredField('date')).toBe(true)
    expect(isBaseRequiredField('summary')).toBe(false)
  })

  it('erkennt Basis-Facetten (title/language sind keine)', () => {
    expect(isBaseFacetField('authors')).toBe(true)
    expect(isBaseFacetField('tags')).toBe(true)
    expect(isBaseFacetField('title')).toBe(false)
    expect(isBaseFacetField('language')).toBe(false)
  })
})

describe('missingBaseFields', () => {
  it('liefert nichts bei vollstaendiger Abdeckung (Extra-Felder ignoriert)', () => {
    const fields = ['title', 'date', 'authors', 'language', 'source', 'tags', 'summary', 'coverImageUrl']
    expect(missingBaseFields(fields)).toEqual([])
  })

  it('meldet fehlende Felder in kanonischer Reihenfolge', () => {
    expect(missingBaseFields(['title', 'language'])).toEqual(['date', 'authors', 'source', 'tags'])
  })

  it('akzeptiert KEINE Aliasse (author != authors, year != date)', () => {
    const fields = ['title', 'year', 'author', 'language', 'source', 'tag']
    expect(missingBaseFields(fields)).toEqual(['date', 'authors', 'tags'])
  })

  it('leere Liste -> alle Pflichtfelder fehlen', () => {
    expect(missingBaseFields([])).toEqual([...BASE_REQUIRED_FIELDS])
  })
})
