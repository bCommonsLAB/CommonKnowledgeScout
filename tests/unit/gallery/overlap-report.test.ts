/**
 * Unit-Tests fuer die puren Bausteine des LLM-Overlap-Berichts (Stufe 3):
 * Massnahmen-Auswahl (Sortierung, Cap, missing), Summen-Berechnung
 * (deterministisch in Code, ohne-Faktor-Handling) und Bericht-Assembly.
 */

import { describe, it, expect } from 'vitest'
import {
  selectOverlapMeasures,
  buildOverlapCatalogTable,
  buildOverlapFactorsMessages,
} from '@/lib/external-jobs/overlap-report-prompt'
import {
  computeOverlapTotals,
  buildOverlapResultTable,
  assembleOverlapReport,
  type AppliedFactors,
} from '@/lib/external-jobs/overlap-report-build'

const factors = (co2: number, kosten: number, mit: string[] = []): AppliedFactors => ({
  faktorCo2: co2,
  faktorKosten: kosten,
  ueberlapptMit: mit,
  begruendung: 'Test',
})

describe('selectOverlapMeasures', () => {
  it('sortiert absteigend nach CO2 und vergibt fortlaufende refs', () => {
    const { selected } = selectOverlapMeasures(
      [
        { title: 'Klein', co2: 1, fileId: 'a' },
        { title: 'Gross', co2: 100, fileId: 'b' },
        { title: 'Mittel', co2: 10, fileId: 'c' },
      ],
      10,
    )
    expect(selected.map((e) => e.title)).toEqual(['Gross', 'Mittel', 'Klein'])
    expect(selected.map((e) => e.ref)).toEqual(['1', '2', '3'])
    // Zusatzfelder (fileId) wandern typsicher durch die Auswahl.
    expect(selected[0].fileId).toBe('b')
  })

  it('weist Massnahmen ohne CO2 separat aus und meldet Cap-Drop explizit', () => {
    const { selected, missingCo2, dropped } = selectOverlapMeasures(
      [
        { title: 'A', co2: 5 },
        { title: 'B', co2: 4 },
        { title: 'C', co2: 3 },
        { title: 'Ohne', co2: undefined },
      ],
      2,
    )
    expect(selected).toHaveLength(2)
    expect(missingCo2.map((e) => e.title)).toEqual(['Ohne'])
    expect(dropped).toBe(1)
  })
})

describe('computeOverlapTotals', () => {
  it('rechnet naive und bereinigte Summen fuer CO2 und Kosten getrennt', () => {
    const entries = [
      { ref: '1', title: 'A', co2: 100, kosten: 1000 },
      { ref: '2', title: 'B', co2: 50, kosten: 500 },
    ]
    const map = new Map([
      ['1', factors(1, 1)],
      ['2', factors(0.5, 0.8)],
    ])
    const totals = computeOverlapTotals(entries, map)
    expect(totals.naiveCo2).toBe(150)
    expect(totals.adjustedCo2).toBe(125)
    expect(totals.naiveKosten).toBe(1500)
    expect(totals.adjustedKosten).toBe(1400)
    expect(totals.withoutFactor).toBe(0)
  })

  it('zaehlt Massnahmen ohne Faktor voll (Obergrenze) und weist sie aus', () => {
    const entries = [
      { ref: '1', title: 'A', co2: 100 },
      { ref: '2', title: 'B', co2: 50 },
    ]
    const map = new Map([['1', factors(0.5, 1)]])
    const totals = computeOverlapTotals(entries, map)
    expect(totals.adjustedCo2).toBe(100) // 100*0.5 + 50*1 (ohne Faktor voll)
    expect(totals.withoutFactor).toBe(1)
  })
})

describe('buildOverlapResultTable', () => {
  it('enthaelt Summenzeile und markiert fehlende Faktoren sichtbar', () => {
    const entries = [
      { ref: '1', massnahmeNr: 'M-7', title: 'A', co2: 100, kosten: 10 },
      { ref: '2', title: 'B', co2: 50 },
    ]
    const table = buildOverlapResultTable(entries, new Map([['1', factors(0.5, 1)]]))
    expect(table).toContain('| M-7 |')
    expect(table).toContain('ohne Faktor')
    expect(table).toContain('**Summe**')
  })
})

describe('buildOverlapCatalogTable / buildOverlapFactorsMessages', () => {
  it('baut Katalog-Tabelle mit refs und adressiert den Output-Slice', () => {
    const entries = [
      { ref: '1', title: 'A', co2: 9 },
      { ref: '2', title: 'B', co2: 5 },
    ]
    const table = buildOverlapCatalogTable(entries)
    expect(table).toContain('| 1 |')
    const messages = buildOverlapFactorsMessages({ catalogTable: table, sliceRefs: ['1', '2'] })
    expect(messages[0].role).toBe('system')
    expect(messages[1].content).toContain('ref 1 bis 2')
    // Beispielanker gegen Verwechslung textliche Naehe vs. echte Ueberlappung.
    expect(messages[0].content).toContain('PV auf Schulen')
  })
})

describe('assembleOverlapReport', () => {
  it('setzt Prosa-Abschnitte, Tabelle, missing-Sektion und Grenzen zusammen', () => {
    const markdown = assembleOverlapReport({
      sections: {
        title: 'Testbericht',
        themenfelder: 'Cluster X.',
        groessenordnungen: 'Viel.',
        handlungsempfehlungen: 'Tun.',
      },
      resultTable: '| Nr |',
      stats: {
        measures: 2, missingCo2: 1, dropped: 0, withoutFactor: 0,
        naiveCo2: 150, adjustedCo2: 125, naiveKosten: 0, adjustedKosten: 0,
      },
      model: 'test-model',
      createdAt: new Date('2026-07-08T12:00:00Z'),
      missingCo2Titles: ['Ohne Angabe GmbH'],
    })
    expect(markdown).toContain('# Testbericht')
    expect(markdown).toContain('## Themenfelder')
    expect(markdown).toContain('## Ergebnis-Tabelle')
    expect(markdown).toContain('Ohne Angabe GmbH')
    expect(markdown).toContain('## Methodik und Grenzen')
    expect(markdown).toContain('2026-07-08')
  })
})
