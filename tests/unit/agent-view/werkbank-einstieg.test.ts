/**
 * @fileoverview Unit-Tests: Zahlen des Werkbank-Einstiegs (Welle A1).
 *
 * Geprueft wird, dass „wartet auf dich" das GETEILTE Praedikat benutzt und
 * nicht neu erfindet: bereit zur Abnahme (null maschinelle Befunde, offene
 * Mensch-Punkte) UND noch nicht abgenommen. Die drei Neben-Karten kommen aus
 * den Library-Totalen, die Nebenzeile aus dem Bestand.
 */

import { describe, it, expect } from 'vitest'
import { zaehleEinstieg } from '@/lib/agent-view/werkbank-einstieg'
import type { CoverageTotals, GapCountByActor, VorhabenCard } from '@/lib/agent-view/types'

function karte(name: string, byActor: GapCountByActor, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: `f-${name}`, name, path: `1. Arbeit/${name}`,
    bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null, hasBericht: true,
    totalGaps: byActor.mensch + byActor.cowork + byActor.knowledgescout,
    gapsByActor: byActor, gapsByType: {}, widerspruch: false,
    ampel: 'gelb', berichtTitel: null, berichtFileId: null,
    berichtModifiedAt: null, berichtStatus: null, themen: [],
    ...overrides,
  }
}

function totals(overrides: Partial<CoverageTotals> = {}): CoverageTotals {
  return {
    folders: 1100, files: 7263, sources: 98, twins: 135, gaps: 1694,
    gapsByType: {}, gapsByActor: { mensch: 32, cowork: 279, knowledgescout: 1383 },
    skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    ...overrides,
  }
}

describe('zaehleEinstieg', () => {
  it('zaehlt als „wartet auf dich" nur bereite, noch nicht abgenommene Vorhaben', () => {
    const zahlen = zaehleEinstieg({
      totals: totals(),
      vorhaben: [
        karte('bereit', { mensch: 28, cowork: 0, knowledgescout: 0 }),
        karte('maschine-offen', { mensch: 2, cowork: 1, knowledgescout: 0 }),
        karte('nichts-offen', { mensch: 0, cowork: 0, knowledgescout: 0 }),
        karte('schon-abgenommen', { mensch: 3, cowork: 0, knowledgescout: 0 }, {
          bearbeitungsstand: 'abgenommen',
        }),
      ],
    })
    expect(zahlen.wartetAufDich).toBe(1)
  })

  it('zaehlt ein abgenommenes Vorhaben MIT Widerspruch wieder als wartend', () => {
    const zahlen = zaehleEinstieg({
      totals: totals(),
      vorhaben: [
        karte('widerspruch', { mensch: 1, cowork: 0, knowledgescout: 0 }, {
          bearbeitungsstand: 'abgenommen', widerspruch: true,
        }),
      ],
    })
    expect(zahlen.wartetAufDich).toBe(1)
  })

  it('nimmt die Akteur-Karten aus den Library-Totalen, nicht aus den Karten', () => {
    const zahlen = zaehleEinstieg({ totals: totals(), vorhaben: [] })
    expect(zahlen).toMatchObject({ mensch: 32, cowork: 279, knowledgescout: 1383 })
  })

  it('reicht den Bestand als Nebenzeile durch — Ordner, Dateien, Quellen, Artefakte', () => {
    const zahlen = zaehleEinstieg({ totals: totals(), vorhaben: [] })
    expect(zahlen.bestand).toEqual({ ordner: 1100, dateien: 7263, quellen: 98, artefakte: 135 })
  })

  it('meldet 0 wartende Vorhaben bei leerem Report, ohne zu raten', () => {
    const zahlen = zaehleEinstieg({
      totals: totals({ gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 } }),
      vorhaben: [],
    })
    expect(zahlen.wartetAufDich).toBe(0)
  })
})
