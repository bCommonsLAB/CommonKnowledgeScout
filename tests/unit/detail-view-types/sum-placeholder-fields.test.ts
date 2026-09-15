/**
 * Summen-Felder der Registry (2026-09-15): Kosten werden fuer Klimamassnahmen
 * nicht mehr summiert, sondern in der Summen-Anzeige als Text
 * „noch zu ermitteln" gefuehrt.
 */

import { describe, it, expect } from 'vitest'
import { getSummableFields, getSumPlaceholderFields, VIEW_TYPE_REGISTRY } from '@ks/contracts'

describe('Summen-Felder fuer climateAction', () => {
  it('summiert nur noch die CO2-Einsparung', () => {
    expect(getSummableFields('climateAction')).toEqual(['co2_einsparung_kt'])
  })

  it('fuehrt die Kosten als Platzhalter-Feld mit i18n-Schluessel', () => {
    expect(getSumPlaceholderFields('climateAction')).toEqual([
      { field: 'kosten_eur', noteKey: 'gallery.sums.pending' },
    ])
  })

  it('ein Feld ist entweder Summe oder Platzhalter, nie beides', () => {
    for (const [viewType, config] of Object.entries(VIEW_TYPE_REGISTRY)) {
      const summable = new Set(config.summableFields ?? [])
      for (const { field } of config.sumPlaceholderFields ?? []) {
        expect(summable.has(field), `${viewType}: ${field}`).toBe(false)
      }
    }
  })

  it('liefert leere Listen fuer Typen ohne Summen und fuer unbekannte Typen', () => {
    expect(getSummableFields('book')).toEqual([])
    expect(getSumPlaceholderFields('book')).toEqual([])
    expect(getSumPlaceholderFields(undefined)).toEqual([])
  })
})
