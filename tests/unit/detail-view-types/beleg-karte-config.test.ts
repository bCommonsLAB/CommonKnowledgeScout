/**
 * Belegkarten-Konfig je Detailansichtstyp (D3): Jedes genannte Feld muss ein
 * Feld des Typs sein, jede Zuordnung auf eine der vier Plaketten zeigen.
 * Sonst zeigt die Karte stillschweigend nichts — genau das soll auffallen.
 */
import { describe, it, expect } from 'vitest'
import { BELEG_PLAKETTEN, DETAIL_VIEW_TYPES, VIEW_TYPE_REGISTRY } from '@ks/contracts'

describe('belegKarte in der ViewType-Registry', () => {
  for (const typ of DETAIL_VIEW_TYPES) {
    const config = VIEW_TYPE_REGISTRY[typ]
    const felder = new Set([...config.requiredFields, ...config.optionalFields])
    const beleg = config.belegKarte
    if (!beleg) continue

    it(`${typ}: Status- und Kennzeilen-Felder sind Felder des Typs`, () => {
      if (beleg.status) expect(felder.has(beleg.status.field), beleg.status.field).toBe(true)
      for (const feld of beleg.kennzeile ?? []) expect(felder.has(feld), feld).toBe(true)
    })

    it(`${typ}: jede Zuordnung zeigt auf eine der vier Plaketten`, () => {
      for (const [wert, plakette] of Object.entries(beleg.status?.plaketten ?? {})) {
        expect(BELEG_PLAKETTEN, `${wert} → ${plakette}`).toContain(plakette)
      }
    })
  }

  it('climateAction legt alle vier Plaketten fest (Entscheidung 01.10.2026)', () => {
    const plaketten = new Set(Object.values(VIEW_TYPE_REGISTRY.climateAction.belegKarte?.status?.plaketten ?? {}))
    expect([...plaketten].sort()).toEqual([...BELEG_PLAKETTEN].sort())
  })
})
