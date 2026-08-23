/**
 * @fileoverview Unit-Tests: geteiltes Praedikat „bereit zur Abnahme" (Werkbank W1).
 *
 * D2-Semantik: null maschinelle Befunde UND mindestens ein Mensch-Befund —
 * ein leerer Scope ist nicht „bereit". MCP-Sicht und UI konsumieren dieselbe
 * Funktion; die Faelle hier sind der Vertrag.
 */

import { describe, it, expect } from 'vitest'
import { istBereitZurAbnahme, zaehleGapsNachAkteur } from '@/lib/agent-view/abnahme'
import type { GapActor } from '@/lib/agent-view/types'

function gaps(...actors: GapActor[]): Array<{ actor: GapActor }> {
  return actors.map((actor) => ({ actor }))
}

describe('istBereitZurAbnahme', () => {
  it('ist bereit, wenn ausschliesslich Mensch-Befunde offen sind', () => {
    expect(istBereitZurAbnahme({ mensch: 3, cowork: 0, knowledgescout: 0 })).toBe(true)
    expect(istBereitZurAbnahme({ mensch: 1, cowork: 0, knowledgescout: 0 })).toBe(true)
  })

  it('ist NICHT bereit, solange ein maschineller Befund offen ist', () => {
    expect(istBereitZurAbnahme({ mensch: 3, cowork: 1, knowledgescout: 0 })).toBe(false)
    expect(istBereitZurAbnahme({ mensch: 0, cowork: 0, knowledgescout: 2 })).toBe(false)
  })

  it('ist NICHT bereit bei leerem Scope — dort gibt es nichts abzunehmen', () => {
    expect(istBereitZurAbnahme({ mensch: 0, cowork: 0, knowledgescout: 0 })).toBe(false)
  })
})

describe('zaehleGapsNachAkteur', () => {
  it('zaehlt je Akteur und laesst fehlende Akteure auf 0 (kein Partial)', () => {
    expect(zaehleGapsNachAkteur(gaps('mensch', 'mensch', 'cowork'))).toEqual({
      mensch: 2,
      cowork: 1,
      knowledgescout: 0,
    })
    expect(zaehleGapsNachAkteur([])).toEqual({ mensch: 0, cowork: 0, knowledgescout: 0 })
  })

  it('bildet mit dem Praedikat die bisherige MCP-Semantik ab (Refactor ohne Verhaltensaenderung)', () => {
    // Vorher: maschinell === 0 && gaps.length > 0 — identisch fuer alle Faelle.
    expect(istBereitZurAbnahme(zaehleGapsNachAkteur(gaps('mensch')))).toBe(true)
    expect(istBereitZurAbnahme(zaehleGapsNachAkteur(gaps('mensch', 'knowledgescout')))).toBe(false)
    expect(istBereitZurAbnahme(zaehleGapsNachAkteur([]))).toBe(false)
  })
})
