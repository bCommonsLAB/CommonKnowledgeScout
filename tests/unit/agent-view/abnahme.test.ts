/**
 * @fileoverview Unit-Tests: geteilte Abnahme-Praedikate (Werkbank W1, ADR 0006).
 *
 * Modell B: Nicht die Zustimmungsquote entscheidet, sondern der Widerstand —
 * maschinelle Befunde plus die Fehler-Markierung des Menschen
 * (`twin_flagged`). Fehlende Verifikation ist kein Widerstand.
 * MCP-Sicht und UI konsumieren dieselben Funktionen; die Faelle hier sind der
 * Vertrag.
 */

import { describe, it, expect } from 'vitest'
import {
  istAbnehmbar,
  wartetAufAbnahme,
  zaehleGapsNachAkteur,
  zaehleGapsNachTyp,
  zaehleWiderstaende,
} from '@/lib/agent-view/abnahme'
import type { CoverageGapType, GapActor } from '@/lib/agent-view/types'

function gaps(...actors: GapActor[]): Array<{ actor: GapActor }> {
  return actors.map((actor) => ({ actor }))
}

function typen(...types: CoverageGapType[]): Array<{ type: CoverageGapType }> {
  return types.map((type) => ({ type }))
}

const KEINE_TYPEN = {}

describe('zaehleWiderstaende', () => {
  it('zaehlt maschinelle Befunde und Fehler-Markierungen zusammen', () => {
    expect(zaehleWiderstaende({ mensch: 0, cowork: 2, knowledgescout: 1 }, { twin_flagged: 3 })).toBe(6)
  })

  it('laesst uebrige Mensch-Befunde aussen vor — sie sperren nichts', () => {
    // 28 unverifizierte Twins gaben es frueher als Befund; heute existiert der
    // Typ nicht mehr. Was bleibt (z. B. stand_widerspruch), ist kein Tor.
    expect(zaehleWiderstaende({ mensch: 28, cowork: 0, knowledgescout: 0 }, { stand_widerspruch: 1 })).toBe(0)
  })
})

describe('istAbnehmbar', () => {
  it('ist wahr, wenn nichts im Weg steht — auch bei leerem Scope', () => {
    expect(istAbnehmbar({ mensch: 0, cowork: 0, knowledgescout: 0 }, KEINE_TYPEN)).toBe(true)
  })

  it('ist wahr, solange nur nicht-sperrende Mensch-Befunde offen sind', () => {
    expect(istAbnehmbar({ mensch: 28, cowork: 0, knowledgescout: 0 }, { self_verified: 1 })).toBe(true)
  })

  it('ist falsch, sobald eine Maschine noch etwas offen hat', () => {
    expect(istAbnehmbar({ mensch: 28, cowork: 1, knowledgescout: 0 }, KEINE_TYPEN)).toBe(false)
    expect(istAbnehmbar({ mensch: 0, cowork: 0, knowledgescout: 1 }, KEINE_TYPEN)).toBe(false)
  })

  it('ist falsch, sobald der Mensch etwas als fehlerhaft markiert hat (ADR 0006)', () => {
    expect(istAbnehmbar({ mensch: 1, cowork: 0, knowledgescout: 0 }, { twin_flagged: 1 })).toBe(false)
  })
})

describe('wartetAufAbnahme', () => {
  const ohneBefund = { gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {} }

  it('ist wahr, wenn kein Widerstand offen und noch nicht abgenommen ist', () => {
    expect(wartetAufAbnahme({ ...ohneBefund, bearbeitungsstand: 'berichtet' })).toBe(true)
    expect(wartetAufAbnahme({ ...ohneBefund, bearbeitungsstand: null })).toBe(true)
  })

  it('ist falsch, sobald das Vorhaben abgenommen ist — es wartet nichts mehr', () => {
    expect(wartetAufAbnahme({ ...ohneBefund, bearbeitungsstand: 'abgenommen' })).toBe(false)
  })

  it('ist falsch, solange ein Widerstand offen ist', () => {
    expect(
      wartetAufAbnahme({
        gapsByActor: { mensch: 0, cowork: 1, knowledgescout: 0 },
        gapsByType: { report_missing: 1 },
        bearbeitungsstand: 'berichtet',
      }),
    ).toBe(false)
    expect(
      wartetAufAbnahme({
        gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
        gapsByType: { twin_flagged: 1 },
        bearbeitungsstand: 'berichtet',
      }),
    ).toBe(false)
  })
})

describe('zaehleGapsNachAkteur / zaehleGapsNachTyp', () => {
  it('zaehlt je Akteur und laesst fehlende Akteure auf 0 (kein Partial)', () => {
    expect(zaehleGapsNachAkteur(gaps('mensch', 'mensch', 'cowork'))).toEqual({
      mensch: 2,
      cowork: 1,
      knowledgescout: 0,
    })
    expect(zaehleGapsNachAkteur([])).toEqual({ mensch: 0, cowork: 0, knowledgescout: 0 })
  })

  it('zaehlt je Typ — nicht vorkommende Typen fehlen (Partial, kein 0-Rauschen)', () => {
    expect(zaehleGapsNachTyp(typen('twin_flagged', 'twin_flagged', 'report_missing'))).toEqual({
      twin_flagged: 2,
      report_missing: 1,
    })
    expect(zaehleGapsNachTyp([])).toEqual({})
  })

  it('urteilt aus beiden Zaehlungen identisch zur Einzelpruefung (MCP = UI)', () => {
    const alle = [
      { actor: 'mensch' as GapActor, type: 'twin_flagged' as CoverageGapType },
      { actor: 'cowork' as GapActor, type: 'report_missing' as CoverageGapType },
    ]
    expect(istAbnehmbar(zaehleGapsNachAkteur(alle), zaehleGapsNachTyp(alle))).toBe(false)
    expect(istAbnehmbar(zaehleGapsNachAkteur([]), zaehleGapsNachTyp([]))).toBe(true)
  })
})
