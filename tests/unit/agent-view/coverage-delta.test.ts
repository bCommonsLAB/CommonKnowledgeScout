/**
 * @fileoverview Unit-Tests: Coverage-Delta (D1) — erledigt/neu statt Gesamtzahl.
 *
 * Positivfall (Befunde wandern), plus die drei ehrlichen Nicht-Vergleiche:
 * erster Scan, anderer Scope, gekappter Vorlauf.
 */

import { describe, it, expect } from 'vitest'
import { computeCoverageDelta } from '@/lib/agent-view/coverage-delta'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageGap, CoverageReport } from '@/lib/agent-view/types'

function gap(path: string, type: CoverageGap['type']): CoverageGap {
  return createGap({
    type, scope: 'source', targetId: `id-${path}`, targetName: path,
    folderId: 'f1', path, message: 'Testbefund',
  })
}

function report(gaps: CoverageGap[], folderId: string | null = 'scope-1'): CoverageReport {
  return {
    libraryId: 'lib-1', generatedAt: '2026-08-21T10:00:00.000Z', derived: true,
    scope: { folderId },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null, indexRequiredMaxDepth: null,
      berichtFreshness: true, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1, files: 1, sources: 1, twins: 0, gaps: gaps.length, gapsByType: {},
      gapsByActor: { mensch: 0, cowork: 0, knowledgescout: gaps.length },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps, tree: [], vorhaben: [], families: [],
  }
}

describe('computeCoverageDelta (D1)', () => {
  it('benennt erledigte und neue Befunde — wandernde Befunde sind beides', () => {
    const previous = report([
      gap('A.m4a', 'transformation_missing'),
      gap('B.pdf', 'source_without_twin'),
    ])
    // A wurde transformiert: der alte Befund weg, ein Verifikations-Befund NEU.
    const next = report([
      gap('A.m4a', 'twin_flagged'),
      gap('B.pdf', 'source_without_twin'),
    ])
    const { delta, hinweis } = computeCoverageDelta({
      previous: { report: previous, generatedAt: '2026-08-21T09:00:00.000Z', gapsTruncated: false },
      next,
    })
    expect(hinweis).toBeNull()
    expect(delta).toMatchObject({
      erledigt: 1, neu: 1,
      erledigtNachTyp: { transformation_missing: 1 },
      neuNachTyp: { twin_flagged: 1 },
      vorherigerScan: '2026-08-21T09:00:00.000Z',
    })
  })

  it('erster Scan, anderer Scope und gekappter Vorlauf geben einen HINWEIS statt 0/0', () => {
    const next = report([gap('A.m4a', 'transformation_missing')])
    expect(computeCoverageDelta({ previous: null, next })).toMatchObject({
      delta: null, hinweis: expect.stringContaining('Erster Scan'),
    })
    expect(
      computeCoverageDelta({
        previous: { report: report([], 'anderer-scope'), generatedAt: 'x', gapsTruncated: false },
        next,
      }),
    ).toMatchObject({ delta: null, hinweis: expect.stringContaining('Anderer Scan-Scope') })
    expect(
      computeCoverageDelta({
        previous: { report: report([]), generatedAt: 'x', gapsTruncated: true },
        next,
      }),
    ).toMatchObject({ delta: null, hinweis: expect.stringContaining('gekappt') })
  })
})
