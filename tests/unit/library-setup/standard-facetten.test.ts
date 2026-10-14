/**
 * E8 (analog F11): Standard-Facetten sind aus der Standard-Vorlage abgeleitet —
 * jede Facette ist ein Feld der Vorlage, kein Kandidat ist tot.
 */
import { describe, it, expect } from 'vitest'
import { DETAIL_VIEW_TYPES } from '@/lib/detail-view-types/registry'
import { BASE_FACET_DEFS } from '@/lib/detail-view-types/base-fields'
import { FACETTEN_KANDIDATEN, felderDerStandardVorlage, standardFacettenFuer } from '@/lib/library-setup/standard-facetten'

describe('standardFacettenFuer', () => {
  it('liefert fuer JEDEN Inhaltstyp nur Felder seiner Standard-Vorlage, Basis-Facetten zuerst', () => {
    for (const typ of DETAIL_VIEW_TYPES) {
      const felder = felderDerStandardVorlage(typ)
      const facetten = standardFacettenFuer(typ)
      expect(facetten.slice(0, BASE_FACET_DEFS.length).map((f) => f.metaKey)).toEqual(BASE_FACET_DEFS.map((d) => d.metaKey))
      for (const f of facetten) expect(felder.has(f.metaKey), `${typ}: ${f.metaKey} fehlt in standard-${typ}`).toBe(true)
      expect(new Set(facetten.map((f) => f.metaKey)).size).toBe(facetten.length)
    }
  })

  it('hat keinen toten Kandidaten', () => {
    for (const k of FACETTEN_KANDIDATEN) {
      const genutzt = DETAIL_VIEW_TYPES.some((typ) => felderDerStandardVorlage(typ).has(k.metaKey))
      expect(genutzt, `Kandidat ${k.metaKey} kommt in keiner Standard-Vorlage vor`).toBe(true)
    }
  })

  it('schlaegt fuer Vortraege Veranstaltung, Track und Sprecher vor', () => {
    const keys = standardFacettenFuer('session').map((f) => f.metaKey)
    expect(keys).toEqual(expect.arrayContaining(['event', 'track', 'speakers', 'year']))
  })
})
