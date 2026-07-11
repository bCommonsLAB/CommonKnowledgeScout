/**
 * Unit-Tests fuer die puren Bausteine des LLM-Overlap-/Wirkungsberichts
 * (Stufe 3): Massnahmen-Auswahl (Sortierung, Cap, missing), Summen-Berechnung
 * (deterministisch in Code, ohne-Faktor-Handling) und das template-getriebene
 * Bericht-Layout (Builtin-Vorlagen + Body-Rendering, seit 2026-07-11).
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
  buildMissingCo2Section,
  type AppliedFactors,
} from '@/lib/external-jobs/overlap-report-build'
import {
  getBuiltinReportTemplate,
  getReportTemplateMarkdown,
  listBuiltinReportTemplates,
  REPORT_TEMPLATE_NAMES,
} from '@/lib/templates/report-templates'
import { renderTemplateBody } from '@/lib/external-jobs/template-body-builder'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

describe('report-templates (Builtin-Vorlagen)', () => {
  it('beide Vorlagen sind parsebar und tragen die erwarteten LLM-Felder', () => {
    const wirkung = getBuiltinReportTemplate('overlap')
    expect(wirkung.name).toBe(REPORT_TEMPLATE_NAMES.overlap)
    expect(wirkung.metadata.fields.map((f) => f.key)).toEqual([
      'title', 'themenfelder', 'groessenordnungen', 'handlungsempfehlungen',
    ])
    expect(wirkung.systemprompt).toContain('Rechne NICHT selbst')

    const enabler = getBuiltinReportTemplate('enabler')
    expect(enabler.name).toBe(REPORT_TEMPLATE_NAMES.enabler)
    expect(enabler.metadata.fields.map((f) => f.key)).toEqual([
      'title', 'cluster_analyse', 'handlungsempfehlungen',
    ])
    expect(listBuiltinReportTemplates()).toHaveLength(2)
  })

  it('Body-Variablen der Vorlagen decken die Code-Variablen ab', () => {
    // Der Bericht entsteht per renderTemplateBody: LLM-Felder + diese
    // deterministischen Variablen muessen im jeweiligen Body vorkommen.
    const wirkungBody = getBuiltinReportTemplate('overlap').markdownBody
    for (const key of ['kennzahlen', 'ergebnis_tabelle', 'ohne_angabe', 'stand', 'modell']) {
      expect(wirkungBody).toContain(`{{${key}}}`)
    }
    const enablerBody = getBuiltinReportTemplate('enabler').markdownBody
    for (const key of ['kennzahlen', 'hebel_tabellen', 'beta', 'beziehungs_stand', 'stand', 'modell']) {
      expect(enablerBody).toContain(`{{${key}}}`)
    }
  })

  it('rendert den Wirkungsbericht-Body vollstaendig (keine offenen Platzhalter)', () => {
    const body = getBuiltinReportTemplate('overlap').markdownBody
    const markdown = renderTemplateBody({
      body,
      values: {
        title: 'Wirkungsbericht Test',
        themenfelder: 'Cluster X.',
        groessenordnungen: 'Viel.',
        handlungsempfehlungen: 'Tun.',
        kennzahlen: '- Analysierte Massnahmen: 2',
        ergebnis_tabelle: '| Nr |',
        ohne_angabe: buildMissingCo2Section(['Ohne Angabe GmbH']),
        stand: '2026-07-11',
        modell: 'test-model',
      },
    })
    expect(markdown).toContain('# Wirkungsbericht Test')
    expect(markdown).toContain('## Ergebnis-Tabelle')
    expect(markdown).toContain('Ohne Angabe GmbH')
    expect(markdown).toContain('2026-07-11')
    expect(markdown).not.toContain('{{')
  })
})

describe('template-samples Snapshots', () => {
  it('Sample-Dateien sind identisch mit den Builtin-Vorlagen (kein Drift)', () => {
    // Entwicklungs-Konvention: jede Vorlage liegt auch als Datei unter
    // template-samples/. Aendert sich der Builtin, MUSS die Datei neu
    // generiert werden (getReportTemplateMarkdown -> Datei schreiben).
    const samples: Array<['overlap' | 'enabler', string]> = [
      ['overlap', 'bericht-wirkung-de.md'],
      ['enabler', 'bericht-enabler-de.md'],
    ]
    for (const [kind, fileName] of samples) {
      const filePath = join(process.cwd(), 'template-samples', fileName)
      const fileContent = readFileSync(filePath, 'utf-8')
      expect(fileContent, `template-samples/${fileName} weicht vom Builtin ab`).toBe(
        getReportTemplateMarkdown(kind),
      )
    }
  })
})

describe('buildMissingCo2Section', () => {
  it('leer bei vollstaendigen Daten, sonst sichtbare Liste', () => {
    expect(buildMissingCo2Section([])).toBe('')
    const section = buildMissingCo2Section(['A', 'B'])
    expect(section).toContain('## Massnahmen ohne CO2-Angabe')
    expect(section).toContain('- A')
  })
})
