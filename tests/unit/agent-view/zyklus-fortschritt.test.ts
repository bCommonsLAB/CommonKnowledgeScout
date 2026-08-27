/**
 * @fileoverview Unit-Tests: Lage im Erschliessungszyklus (Rueckfrage 27.08.2026).
 *
 * Der Zyklus hat vier Schritte mit festen Zustaendigkeiten
 * (`erschliessungszyklus.md` §1). Geprueft wird: Zuordnung der Befunde je
 * Schritt, welcher Schritt dran ist, dass der erklaerte Stand daneben steht
 * statt hineingerechnet zu werden, und dass Markierungen nicht doppelt zaehlen.
 */

import { describe, it, expect } from 'vitest'
import { berechneZyklusFortschritt } from '@/lib/agent-view/zyklus-fortschritt'

const OHNE_MARKIERUNG = { markierungen: 0 }

describe('berechneZyklusFortschritt', () => {
  it('ordnet Befunde ihrem Schritt zu und nennt den ersten offenen als „dran"', () => {
    const fortschritt = berechneZyklusFortschritt({
      // report_missing = Schritt 3 (Cowork), verweis_tot = Schritt 3
      gapsByType: { report_missing: 1, verweis_tot: 2 },
      bearbeitungsstand: 'strukturiert',
      ...OHNE_MARKIERUNG,
    })
    expect(fortschritt.dran).toBe(3)
    expect(fortschritt.offenGesamt).toBe(3)
    expect(fortschritt.schritte.find((s) => s.schritt === 3)?.offen).toBe(3)
    expect(fortschritt.schritte.find((s) => s.schritt === 1)?.offen).toBe(0)
  })

  it('nimmt den FRUEHESTEN offenen Schritt — dort liegt die Arbeit', () => {
    const fortschritt = berechneZyklusFortschritt({
      gapsByType: { source_without_twin: 1, report_missing: 5 },
      bearbeitungsstand: 'berichtet',
      ...OHNE_MARKIERUNG,
    })
    expect(fortschritt.dran).toBe(1)
  })

  it('null, wenn nichts offen ist — dann fehlt nur die Abnahme', () => {
    const fortschritt = berechneZyklusFortschritt({
      gapsByType: {},
      bearbeitungsstand: 'berichtet',
      ...OHNE_MARKIERUNG,
    })
    expect(fortschritt.dran).toBeNull()
    expect(fortschritt.offenGesamt).toBe(0)
  })

  it('schlaegt Fehler-Markierungen Schritt 4 zu — die loest der Mensch auf', () => {
    const fortschritt = berechneZyklusFortschritt({
      gapsByType: {},
      bearbeitungsstand: 'berichtet',
      markierungen: 2,
    })
    expect(fortschritt.dran).toBe(4)
    expect(fortschritt.schritte.find((s) => s.schritt === 4)?.offen).toBe(2)
  })

  it('zaehlt eine Markierung NICHT doppelt, wenn der Report sie schon kennt', () => {
    const fortschritt = berechneZyklusFortschritt({
      gapsByType: { twin_flagged: 2 },
      bearbeitungsstand: 'berichtet',
      markierungen: 2,
    })
    expect(fortschritt.schritte.find((s) => s.schritt === 4)?.offen).toBe(2)
  })

  it('stellt den erklaerten Stand daneben, statt ihn hineinzurechnen', () => {
    // Stand behauptet „berichtet" (Schritte 1-3 erledigt), obwohl Schritt 1
    // offene Punkte hat — genau der Widerspruch, den ein eigener Befund meldet.
    const fortschritt = berechneZyklusFortschritt({
      gapsByType: { source_without_twin: 3 },
      bearbeitungsstand: 'berichtet',
      ...OHNE_MARKIERUNG,
    })
    expect(fortschritt.schritte.find((s) => s.schritt === 1)).toMatchObject({
      offen: 3,
      behauptetErledigt: true,
      istDran: true,
    })
  })

  it('ohne erklaerten Stand behauptet nichts als erledigt', () => {
    const fortschritt = berechneZyklusFortschritt({
      gapsByType: {},
      bearbeitungsstand: null,
      ...OHNE_MARKIERUNG,
    })
    expect(fortschritt.schritte.every((s) => !s.behauptetErledigt)).toBe(true)
  })

  it('wirft bei unbekanntem Gap-Typ, statt ihn still zu verschlucken', () => {
    expect(() =>
      berechneZyklusFortschritt({
        gapsByType: { zukunftstyp: 1 } as never,
        bearbeitungsstand: null,
        ...OHNE_MARKIERUNG,
      }),
    ).toThrow(/Unbekannter Gap-Typ/)
  })
})
