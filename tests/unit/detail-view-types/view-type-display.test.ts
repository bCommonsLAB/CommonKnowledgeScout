import { describe, it, expect } from 'vitest'
import {
  getViewTypeLabel,
  getPresentDetailViewTypes,
  VIEW_TYPE_LABELS,
} from '@/lib/detail-view-types/view-type-display'

describe('getViewTypeLabel', () => {
  it('liefert ein Label fuer gueltige Typen', () => {
    expect(getViewTypeLabel('book')).toBe('Buch')
    expect(getViewTypeLabel('climateAction')).toBe('Klimamaßnahme')
  })

  it('liefert null fuer unbekannte oder fehlende Typen (kein Raten)', () => {
    expect(getViewTypeLabel('nope')).toBeNull()
    expect(getViewTypeLabel(undefined)).toBeNull()
    expect(getViewTypeLabel('')).toBeNull()
  })

  it('hat fuer jeden registrierten Typ ein nicht-leeres Label', () => {
    for (const label of Object.values(VIEW_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })
})

describe('getPresentDetailViewTypes', () => {
  it('liefert distinkte, gueltige Typen in Registry-Reihenfolge', () => {
    const result = getPresentDetailViewTypes(['session', 'book', 'book', 'session', undefined, 'nope'])
    expect(result).toEqual(['book', 'session'])
  })

  it('ignoriert ungueltige und leere Werte', () => {
    expect(getPresentDetailViewTypes(['nope', '', undefined])).toEqual([])
  })

  it('liefert bei nur einem Typ die Laenge 1 (keine Format-Spalte noetig)', () => {
    expect(getPresentDetailViewTypes(['book', 'book'])).toEqual(['book'])
  })
})
