/**
 * C1 (Plan speicher-verbindungen-und-library-anlage §5): Der Katalog bildet
 * die 19 Zeilen der Tabelle ab, Gewichte nach Owner-Entscheid E6.
 */
import { describe, it, expect } from 'vitest'
import { ENTSCHEIDUNGEN, entscheidung } from '@/lib/library-setup/entscheidungen'
import { INHALTSTYP_MERKMALE } from '@/lib/library-setup/inhaltstyp-merkmale'
import { DETAIL_VIEW_TYPES } from '@/lib/detail-view-types/registry'

describe('ENTSCHEIDUNGEN', () => {
  it('hat genau die Zeilen 1 bis 19, jede mit eindeutigem Schluessel', () => {
    expect(ENTSCHEIDUNGEN.map((e) => e.nr)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1))
    expect(new Set(ENTSCHEIDUNGEN.map((e) => e.schluessel)).size).toBe(19)
  })

  it('traegt die Gewichte aus §5 (E6)', () => {
    const nachGewicht = (g: string) => ENTSCHEIDUNGEN.filter((e) => e.gewicht === g).map((e) => e.nr)
    expect(nachGewicht('pflicht')).toEqual([1, 2, 3])
    expect(nachGewicht('empfohlen')).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(nachGewicht('spaeter')).toEqual([12, 13, 14, 15, 16, 17, 18, 19])
  })

  it('nennt fuer jede nicht-pflichtige Zeile eine Vorgabe, fuer Pflicht keine', () => {
    for (const e of ENTSCHEIDUNGEN) {
      if (e.gewicht === 'pflicht') expect(e.vorgabe, e.schluessel).toBeNull()
      else expect(e.vorgabe?.trim().length, e.schluessel).toBeGreaterThan(0)
    }
  })

  it('stellt jede Frage mit Text und ordnet „spaeter" den Settings zu', () => {
    for (const e of ENTSCHEIDUNGEN) {
      expect(e.frage.trim().length, e.schluessel).toBeGreaterThan(10)
      if (e.gewicht === 'spaeter') expect(e.schritt).toBe('settings')
      else expect(e.schritt).not.toBe('settings')
    }
  })

  it('wirft bei unbekanntem Schluessel', () => {
    expect(() => entscheidung('gibtsnicht')).toThrow(/Unbekannte Entscheidung/)
  })
})

describe('INHALTSTYP_MERKMALE', () => {
  it('kennt jeden Inhaltstyp (kein stilles Erben)', () => {
    expect(Object.keys(INHALTSTYP_MERKMALE).sort()).toEqual([...DETAIL_VIEW_TYPES].sort())
  })
})
