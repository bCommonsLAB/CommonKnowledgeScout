/**
 * @fileoverview Unit-Tests: Arbeitslisten-Kreuzung + Fortschrittskopf (F7, W6).
 *
 * Kreuztest der Buecher auf Funktionsebene (Akzeptanzkriterium 2): Mitglieder
 * ohne Karte im Report werden TOTE Eintraege — sichtbar mit `pathSnapshot`,
 * nie still verworfen; ein geloeschter Report macht ALLE Mitglieder tot,
 * loescht aber kein Mitglied. Fortschritt: fertig = abgenommen ohne
 * Widerspruch, bereit = geteiltes Praedikat, offene Befunde M/C/K summiert.
 */

import { describe, it, expect } from 'vitest'
import type { VorhabenCard } from '@/lib/agent-view/types'
import {
  kreuzeListeMitReport,
  zaehleWorklistFortschritt,
  type WorklistMitglied,
} from '@/lib/agent-view/worklist-fortschritt'

function karte(folderId: string, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId, name: folderId, path: folderId,
    bearbeitungsstand: null, bearbeitungsstandSeit: null, hasBericht: false,
    totalGaps: 0, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {},
    widerspruch: false, ampel: 'gruen', berichtTitel: null, berichtFileId: null,
    berichtModifiedAt: null, berichtStatus: null, themen: [],
    ...overrides,
  }
}

function mitglied(folderId: string): WorklistMitglied {
  return { folderId, pathSnapshot: `Pfad/${folderId}`, name: folderId }
}

describe('kreuzeListeMitReport', () => {
  it('trennt lebende Karten von toten Eintraegen — Listen-Reihenfolge bleibt', () => {
    const { karten, tote } = kreuzeListeMitReport(
      [mitglied('f-b'), mitglied('f-weg'), mitglied('f-a')],
      [karte('f-a'), karte('f-b')],
    )
    expect(karten.map((k) => k.folderId)).toEqual(['f-b', 'f-a'])
    expect(tote).toEqual([{ folderId: 'f-weg', pathSnapshot: 'Pfad/f-weg', name: 'f-weg' }])
  })

  it('geloeschter Report (keine Vorhaben) macht alle Mitglieder tot — verliert aber keins (Akzeptanzkriterium 2)', () => {
    const mitglieder = [mitglied('f-a'), mitglied('f-b')]
    const { karten, tote } = kreuzeListeMitReport(mitglieder, [])
    expect(karten).toEqual([])
    expect(tote).toHaveLength(2)
  })
})

describe('zaehleWorklistFortschritt', () => {
  it('fertig = abgenommen ohne Widerspruch; bereit via geteiltem Praedikat; Rest offen', () => {
    const fortschritt = zaehleWorklistFortschritt([
      karte('f-fertig', { bearbeitungsstand: 'abgenommen' }),
      karte('f-widerspruch', { bearbeitungsstand: 'abgenommen', widerspruch: true }),
      karte('f-bereit', { gapsByActor: { mensch: 2, cowork: 0, knowledgescout: 0 } }),
      karte('f-offen', { gapsByActor: { mensch: 1, cowork: 3, knowledgescout: 0 } }),
    ])
    // ADR 0006: „bereit" heisst „kein Widerstand offen". Das abgenommene
    // Vorhaben MIT Widerspruch faellt damit in bereit (es wartet erneut auf
    // die Beurkundung), nicht mehr in offen.
    expect(fortschritt).toEqual({
      gesamt: 4,
      fertig: 1,
      bereit: 2,
      offen: 1,
      offeneBefunde: { mensch: 3, cowork: 3, knowledgescout: 0 },
    })
  })

  it('abgenommen mit Widerspruch zaehlt bereit, wenn das Praedikat greift', () => {
    const fortschritt = zaehleWorklistFortschritt([
      karte('f-w', { bearbeitungsstand: 'abgenommen', widerspruch: true, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 } }),
    ])
    expect(fortschritt.fertig).toBe(0)
    expect(fortschritt.bereit).toBe(1)
  })
})
