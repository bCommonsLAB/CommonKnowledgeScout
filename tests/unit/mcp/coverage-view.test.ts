/**
 * @fileoverview Unit-Tests: kompakte Coverage-Sicht der MCP-Bruecke (Welle 5).
 *
 * Pfad-Filter, explizite Kappung und der Vor-Welle-4-Report (ohne Familien)
 * — jeweils Positiv- und Negativfall.
 */

import { describe, it, expect } from 'vitest'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageGap, CoverageReport, CoverageTreeNode, TwinFamilySummary } from '@/lib/agent-view/types'
import { isInSubtree, summarizeCoverageReport } from '@/lib/mcp/coverage-view'

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

  it('weist die Kappung des GESPEICHERTEN Reports aus', () => {
    const view = summarize({}, { storedGapsTruncated: true, totalGaps: 9999 })
    expect(view.gespeicherterReportGekappt).toEqual({ gespeicherteGaps: 2, totalGaps: 9999 })
  })
})
