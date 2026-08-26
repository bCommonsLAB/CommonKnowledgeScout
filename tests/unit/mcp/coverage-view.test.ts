/**
 * @fileoverview Unit-Tests: kompakte Coverage-Sicht der MCP-Bruecke (Welle 5).
 *
 * Pfad-Filter, explizite Kappung und der Vor-Welle-4-Report (ohne Familien)
 * — jeweils Positiv- und Negativfall.
 */

import { describe, it, expect } from 'vitest'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageGap, CoverageReport, CoverageTreeNode, TwinFamilySummary } from '@/lib/agent-view/types'
import { isInSubtree, mapPrefixToScope, summarizeCoverageReport } from '@/lib/mcp/coverage-view'

function treeNode(path: string, overrides: Partial<CoverageTreeNode> = {}): CoverageTreeNode {
  return {
    folderId: `id-${path || 'root'}`, name: path.split('/').pop() ?? '', path,
    depth: path === '' ? 0 : path.split('/').length,
    bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: false, hasBericht: false,
    sourceCount: 0, fileCount: 0, ownGaps: 0, totalGaps: 0, gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    ampel: 'gruen', children: [], ...overrides,
  }
}

function gap(path: string, type: CoverageGap['type'] = 'source_without_twin'): CoverageGap {
  return createGap({
    type, scope: 'source', targetId: `id-${path}`, targetName: path.split('/').pop() ?? path,
    folderId: 'f1', path, message: 'Testbefund',
  })
}

function family(path: string): TwinFamilySummary {
  return {
    sourceId: `src-${path}`, sourceName: path.split('/').pop() ?? path, folderId: 'f1', path,
    artifactCount: 1,
    leading: {
      kind: 'transcript', templateName: null, targetLanguage: '', twinStatus: null,
      generatedBy: 'knowledgescout/x', generatedAt: '2026-08-01T10:00:00.000Z',
      verifiedBy: null, verifiedAt: null, verification: 'unverifiziert',
    },
  }
}

function report(overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    libraryId: 'lib-1', generatedAt: '2026-08-19T10:00:00.000Z', derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null, indexRequiredMaxDepth: null,
      berichtFreshness: true, scanExcludeGlobs: [],
    },
    totals: {
      folders: 2, files: 3, sources: 2, twins: 1, gaps: 2, gapsByType: {},
      gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 2 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [gap('Pilot/A.pdf'), gap('Anderswo/B.pdf')],
    tree: [
      treeNode('', {
        totalGaps: 2,
        children: [
          treeNode('Pilot', { totalGaps: 1, sourceCount: 1 }),
          treeNode('Anderswo', { totalGaps: 1, children: [treeNode('Anderswo/Tief')] }),
        ],
      }),
    ],
    vorhaben: [],
    families: [family('Pilot/A.pdf'), family('Anderswo/B.pdf')],
    ...overrides,
  }
}

function summarize(overrides: Partial<CoverageReport> = {}, args: Partial<Parameters<typeof summarizeCoverageReport>[0]> = {}) {
  return summarizeCoverageReport({
    report: report(overrides), generatedAt: '2026-08-19T10:00:00.000Z',
    storedGapsTruncated: false, totalGaps: 2, ...args,
  })
}

describe('isInSubtree', () => {
  it('matcht exakte Pfade und echte Teilbaeume, keine Namens-Praefixe', () => {
    expect(isInSubtree('Pilot/A.pdf', 'Pilot')).toBe(true)
    expect(isInSubtree('Pilot', 'Pilot')).toBe(true)
    expect(isInSubtree('Pilotprojekt/A.pdf', 'Pilot')).toBe(false)
    expect(isInSubtree('Anderswo/B.pdf', '')).toBe(true)
  })
})

describe('summarizeCoverageReport', () => {
  it('filtert Befunde und Familien auf den Pfad (Positivfall)', () => {
    const view = summarize({}, { pathPrefix: 'Pilot' })
    expect(view.filter.pfad).toBe('Pilot')
    expect(view.filter.befundAnzahl).toBe(1)
    expect(view.filter.befunde[0].path).toBe('Pilot/A.pdf')
    expect(view.filter.familienAnzahl).toBe(1)
    // Library-weite Zaehler bleiben unveraendert sichtbar.
    expect(view.totalsLibraryWeit.gaps).toBe(2)
  })

  it('ohne Filter kommt alles; Kappung wird explizit ausgewiesen', () => {
    const view = summarize({}, { maxGaps: 1, maxFamilies: 1 })
    expect(view.filter.befundAnzahl).toBe(2)
    expect(view.filter.befunde).toHaveLength(1)
    expect(view.filter.befundeGekappt).toBe(true)
    expect(view.filter.familienGekappt).toBe(true)
  })

  it('benennt Reports aus Scans vor Welle 4 statt still ohne Familien zu antworten', () => {
    const view = summarize({ families: undefined })
    expect(view.filter.familien).toContain('vor Welle 4')
    expect(view.filter.familienAnzahl).toBeNull()
  })

  it('liefert die Ordnerliste mit folderIds fuer Teilbaum-Scans (nach Befunden sortiert)', () => {
    const alle = summarize()
    expect(alle.filter.ordner[0]).toMatchObject({ path: '(Wurzel)', folderId: 'id-root', befundeImTeilbaum: 2 })
    expect(alle.filter.ordner.map((o) => o.path)).toContain('Anderswo/Tief')

    // Pfad-Filter: Teilbaum-Ordner UND die Vorfahren (fuer den Kontext) bleiben.
    const gefiltert = summarize({}, { pathPrefix: 'Anderswo' })
    const pfade = gefiltert.filter.ordner.map((o) => o.path)
    expect(pfade).toContain('Anderswo')
    expect(pfade).toContain('Anderswo/Tief')
    expect(pfade).not.toContain('Pilot')

    // Kappung ist explizit.
    const gekappt = summarize({}, { maxFolders: 1 })
    expect(gekappt.filter.ordner).toHaveLength(1)
    expect(gekappt.filter.ordnerGekappt).toBe(true)
    expect(gekappt.filter.ordnerAnzahl).toBe(4)
  })

  it('bildet library-relative Filter auf Teilbaum-Reports ab (Cowork-Befund: scope-relative Pfade)', () => {
    expect(mapPrefixToScope('A/B/Pilot', 'A/B')).toBe('Pilot')
    expect(mapPrefixToScope('A/B', 'A/B')).toBe('')
    expect(mapPrefixToScope('A', 'A/B')).toBe('')
    expect(mapPrefixToScope('Pilot', 'A/B')).toBe('Pilot')

    const view = summarize(
      { scope: { folderId: 'fid-scope', path: '4. Aktivismus/26.01 Klima' } },
      { pathPrefix: '4. Aktivismus/26.01 Klima/Pilot' },
    )
    expect(view.filter.pfad).toBe('Pilot')
    expect(view.filter.pfadAngefragt).toBe('4. Aktivismus/26.01 Klima/Pilot')
    expect(view.filter.befundAnzahl).toBe(1)
    expect(view.scopeHinweis).toContain('26.01 Klima')

    // Ohne Scope bleibt alles wie bisher.
    expect(summarize().scopeHinweis).toBeNull()
  })

  it('meldet einen Pfad-Filter, der ins Leere greift, statt still 0 Befunde (Pilot-Befund)', () => {
    // Teilbaum-Scan per folderId: Report kennt seinen library-relativen Pfad NICHT.
    const blind = summarize(
      { scope: { folderId: 'fid-scope', path: null } },
      { pathPrefix: '4. Aktivismus/26.01 Klima' },
    )
    expect(blind.filter.befundAnzahl).toBe(0)
    expect(blind.filter.warnung).toContain('traf NICHTS')
    expect(blind.filter.warnung).toContain('KEINE Entwarnung')
    expect(blind.filter.warnung).toContain('Teilbaum-Scan per folderId'.replace('Teilbaum', 'TEILBAUM'))

    // Tippfehler im Pfad bei vollem Report: andere Ursache, andere Empfehlung.
    const tippfehler = summarize({}, { pathPrefix: 'Piloot' })
    expect(tippfehler.filter.warnung).toContain('Pfad pruefen')

    // Treffer -> keine Warnung; kein Filter -> keine Warnung.
    expect(summarize({}, { pathPrefix: 'Pilot' }).filter.warnung).toBeNull()
    expect(summarize().filter.warnung).toBeNull()

    // Leerer Report: „nichts gefunden" ist hier die Wahrheit, keine Warnung.
    expect(summarize({ gaps: [] }, { pathPrefix: 'Pilot' }).filter.warnung).toBeNull()
  })

  it('Befunde tragen targetId/folderId/scope (C1 — Befund → Aktion als Feldzugriff)', () => {
    const view = summarize()
    const befund = view.filter.befunde[0] as { targetId?: string; folderId?: string; scope?: string }
    expect(befund.targetId).toBe('id-Pilot/A.pdf')
    expect(befund.folderId).toBe('f1')
    expect(befund.scope).toBe('source')
  })

  it('filtert nach Akteur/Zyklus-Schritt und liefert nurZaehler ohne Listen (C5)', () => {
    // Alle Test-Gaps sind knowledgescout/Schritt 1 — mensch-Filter leert die Liste,
    // ohne die Pfad-Leerlauf-Warnung auszuloesen (die gilt nur dem Pfad-Filter).
    const nurMensch = summarize({}, { akteur: 'mensch' })
    expect(nurMensch.filter.befundAnzahl).toBe(0)
    expect(nurMensch.filter.warnung).toBeNull()

    const schritt1 = summarize({}, { zyklusSchritt: 1 })
    expect(schritt1.filter.befundAnzahl).toBe(2)

    const zaehler = summarize({}, { nurZaehler: true })
    expect(zaehler.filter.befunde).toEqual([])
    expect(zaehler.filter.familien).toEqual([])
    expect(zaehler.filter.nurZaehler).toContain('bewusst leer')
    expect(zaehler.filter.befundeNachTyp).toEqual({ source_without_twin: 2 })
  })

  it('benennt „bereit zur Abnahme“: kein Widerstand offen (D2, ADR 0006)', () => {
    const gemischt = summarize()
    expect(gemischt.filter.bereitZurAbnahme).toBe(false)

    // Nicht-sperrender Mensch-Befund: bereit.
    const nurMensch = summarize({
      gaps: [gap('Pilot/A.pdf', 'stand_widerspruch')],
    })
    expect(nurMensch.filter.bereitZurAbnahme).toBe(true)

    // Fehler-Markierung sperrt — sie ist ein benannter Widerstand.
    const markiert = summarize({
      gaps: [gap('Pilot/A.pdf', 'twin_flagged')],
    })
    expect(markiert.filter.bereitZurAbnahme).toBe(false)

    // Leerer Scope: nichts steht im Weg.
    expect(summarize({ gaps: [] }).filter.bereitZurAbnahme).toBe(true)
  })

  it('weist die Kappung des GESPEICHERTEN Reports aus', () => {
    const view = summarize({}, { storedGapsTruncated: true, totalGaps: 9999 })
    expect(view.gespeicherterReportGekappt).toEqual({ gespeicherteGaps: 2, totalGaps: 9999 })
  })

  it('liefert Vokabular + gepflegte Themen je Vorhaben (A6 — sonst raet der Agent)', () => {
    const vorhaben = [
      { folderId: 'v1', name: '26.01 Klima', path: 'Pilot/26.01 Klima', bearbeitungsstand: null,
        bearbeitungsstandSeit: null, hasBericht: true, totalGaps: 0,
        gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {},
        widerspruch: false, gepflegteThemen: ['ACT-Klima', 'DEV-Klimamassnahmen'] },
      { folderId: 'v2', name: '26.02 Ohne', path: 'Anderswo/26.02 Ohne', bearbeitungsstand: null,
        bearbeitungsstandSeit: null, hasBericht: false, totalGaps: 0,
        gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {},
        widerspruch: false, gepflegteThemen: [] },
      { folderId: 'v3', name: '26.03 Alt', path: 'Anderswo/26.03 Alt', bearbeitungsstand: null,
        bearbeitungsstandSeit: null, hasBericht: false, totalGaps: 0,
        gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {},
        widerspruch: false },
    ]
    const view = summarize({ vorhaben }, { themenVokabular: ['ACT-Klima', 'LIB-Klimamassnahmen'] })
    expect(view.themen.vokabular).toEqual(['ACT-Klima', 'LIB-Klimamassnahmen'])
    expect(view.themen.jeVorhaben).toEqual([
      { path: 'Pilot/26.01 Klima', folderId: 'v1', themen: ['ACT-Klima', 'DEV-Klimamassnahmen'] },
      { path: 'Anderswo/26.02 Ohne', folderId: 'v2', themen: [] },
      // Report vor A6: null (benannt, nicht geraten).
      { path: 'Anderswo/26.03 Alt', folderId: 'v3', themen: null },
    ])
    expect(view.themen.ohneThema).toBe(1)

    // Pfad-Filter grenzt auch die Themen-Sicht ein; ohne Vokabular steht null.
    const gefiltert = summarize({ vorhaben }, { pathPrefix: 'Pilot' })
    expect(gefiltert.themen.vokabular).toBeNull()
    expect(gefiltert.themen.jeVorhaben.map((v) => v.folderId)).toEqual(['v1'])

    // nurZaehler laesst die Liste bewusst leer, Zaehler bleiben.
    const zaehler = summarize({ vorhaben }, { nurZaehler: true })
    expect(zaehler.themen.jeVorhaben).toEqual([])
    expect(zaehler.themen.jeVorhabenAnzahl).toBe(3)
  })
})
