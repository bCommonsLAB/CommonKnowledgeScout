/**
 * Characterization Tests fuer Pure-Helpers in
 * `gallery-root/helpers.ts` (Welle 3-III-a, Schritt 2/N).
 *
 * Sicherheitsnetz fuer den gallery-root.tsx Refactor. Fixiert:
 * - resolveInitialDetailViewType: Validierung + 'book'-Default
 * - resolveGroupByField: Default 'year'
 * - pickFacetsForTableColumns: Filter nach showInTable + nicht-leerer metaKey
 * - resolveDetailViewTypeForDoc: Prioritaet doc > library > 'book'
 *
 * Reine Pure-Helpers, kein React-Render noetig.
 */

import { describe, it, expect } from 'vitest'
import {
  VALID_DETAIL_VIEW_TYPES,
  resolveInitialDetailViewType,
  resolveGroupByField,
  pickFacetsForTableColumns,
  resolveDetailViewTypeForDoc,
} from '@/components/library/gallery/gallery-root/helpers'

describe('VALID_DETAIL_VIEW_TYPES', () => {
  it('enthaelt alle 8 erwarteten DetailViewTypes', () => {
    expect(VALID_DETAIL_VIEW_TYPES).toEqual([
      'book',
      'session',
      'climateAction',
      'testimonial',
      'blog',
      'divaDocument',
      'divaTexture',
      'refurbedDevice',
    ])
  })
})

describe('resolveInitialDetailViewType', () => {
  it('akzeptiert alle gueltigen Typen', () => {
    for (const t of VALID_DETAIL_VIEW_TYPES) {
      expect(resolveInitialDetailViewType(t)).toBe(t)
    }
  })

  it('liefert "book" als Default bei undefined', () => {
    expect(resolveInitialDetailViewType(undefined)).toBe('book')
  })

  it('liefert "book" als Default bei nicht-string Wert', () => {
    expect(resolveInitialDetailViewType(42)).toBe('book')
    expect(resolveInitialDetailViewType(null)).toBe('book')
    expect(resolveInitialDetailViewType({})).toBe('book')
  })

  it('liefert "book" als Default bei unbekanntem string', () => {
    expect(resolveInitialDetailViewType('foo')).toBe('book')
    expect(resolveInitialDetailViewType('')).toBe('book')
  })
})

describe('resolveGroupByField', () => {
  it('liefert "year" als Default bei undefined', () => {
    expect(resolveGroupByField(undefined)).toBe('year')
  })

  it('liefert "year" als Default bei leerem string', () => {
    expect(resolveGroupByField('')).toBe('year')
  })

  it('liefert "year" als Default bei nicht-string Wert', () => {
    expect(resolveGroupByField(123)).toBe('year')
    expect(resolveGroupByField(null)).toBe('year')
  })

  it('akzeptiert beliebige nicht-leere strings', () => {
    expect(resolveGroupByField('category')).toBe('category')
    expect(resolveGroupByField('none')).toBe('none')
    expect(resolveGroupByField('handlungsfeld')).toBe('handlungsfeld')
  })
})

describe('pickFacetsForTableColumns', () => {
  it('liefert undefined, wenn facets kein Array ist', () => {
    expect(pickFacetsForTableColumns(undefined)).toBeUndefined()
    expect(pickFacetsForTableColumns(null)).toBeUndefined()
    expect(pickFacetsForTableColumns({})).toBeUndefined()
  })

  it('liefert leeres Array, wenn keine Facette showInTable=true ist', () => {
    expect(pickFacetsForTableColumns([
      { metaKey: 'a', showInTable: false },
      { metaKey: 'b' },
    ])).toEqual([])
  })

  it('filtert Facets ohne metaKey heraus, auch wenn showInTable=true', () => {
    expect(pickFacetsForTableColumns([
      { showInTable: true } as { showInTable: boolean },
      { metaKey: '', showInTable: true },
    ])).toEqual([])
  })

  it('uebernimmt label, wenn vorhanden', () => {
    expect(pickFacetsForTableColumns([
      { metaKey: 'category', label: 'Kategorie', showInTable: true },
      { metaKey: 'tags', showInTable: true },
    ])).toEqual([
      { metaKey: 'category', label: 'Kategorie' },
      { metaKey: 'tags', label: undefined },
    ])
  })
})

describe('resolveDetailViewTypeForDoc', () => {
  it('bevorzugt einen gueltigen doc-Wert ueber library-Fallback', () => {
    expect(resolveDetailViewTypeForDoc('session', 'book')).toBe('session')
  })

  it('faellt auf library zurueck, wenn doc-Wert kein string ist', () => {
    expect(resolveDetailViewTypeForDoc(undefined, 'climateAction')).toBe('climateAction')
    expect(resolveDetailViewTypeForDoc(null, 'climateAction')).toBe('climateAction')
  })

  it('faellt auf library zurueck, wenn doc-Wert ein unbekannter string ist', () => {
    expect(resolveDetailViewTypeForDoc('foo', 'session')).toBe('session')
  })

  it('faellt auf "book" zurueck, wenn library-Fallback ungueltig ist', () => {
    // Wir muessen casten, weil der Type bewusst eingegrenzt ist
    // — der Test pruefen den Runtime-Fallback.
    const result = resolveDetailViewTypeForDoc(undefined, 'foo' as never)
    expect(result).toBe('book')
  })
})
