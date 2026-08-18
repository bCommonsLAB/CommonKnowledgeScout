// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CoverageTree } from '@/components/library/agent-view/coverage-tree'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageReport, CoverageTreeNode } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function node(overrides: Partial<CoverageTreeNode> = {}): CoverageTreeNode {
  return {
    folderId: 'f-pilot',
    name: '25.01 Pilot',
    path: '25.01 Pilot',
    depth: 1,
    bearbeitungsstand: 'abgenommen',
    bearbeitungsstandSeit: null,
    hasIndex: true,
    hasBericht: true,
    sourceCount: 2,
    fileCount: 5,
    ownGaps: 0,
    totalGaps: 0,
    gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    ampel: 'gruen',
    children: [],
    ...overrides,
  }
}

function report(tree: CoverageTreeNode[], gaps: CoverageReport['gaps'] = []): CoverageReport {
  return {
    libraryId: 'lib-1',
    generatedAt: '2026-08-18T12:00:00.000Z',
    derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null, indexRequiredMaxDepth: null,
      berichtFreshness: true, scanExcludeGlobs: [],
    },
    totals: {
      folders: tree.length, files: 0, sources: 0, twins: 0, gaps: gaps.length,
      gapsByType: {}, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps,
    tree,
    vorhaben: [],
  }
}

describe('CoverageTree', () => {
  it('zeigt Name, erklaerten Stand und Zaehler eines Ordners', () => {
    render(<CoverageTree report={report([node()])} />)
    expect(screen.getByText('25.01 Pilot')).toBeTruthy()
    expect(screen.getByText('Abgenommen')).toBeTruthy()
    expect(screen.getByText('2 Quellen')).toBeTruthy()
    expect(screen.getByText('5 Dateien')).toBeTruthy()
  })

  it('faerbt die Ampel gruen nur ohne Befund im Teilbaum', () => {
    const { container } = render(<CoverageTree report={report([node()])} />)
    expect(container.querySelector('[aria-label="Kein Befund im Teilbaum"]')).toBeTruthy()
    cleanup()
    const rot = render(<CoverageTree report={report([node({ ampel: 'rot', totalGaps: 3 })])} />)
    expect(rot.container.querySelector('[aria-label="Offene Befunde im Teilbaum"]')).toBeTruthy()
    expect(screen.getByText('3 Befunde')).toBeTruthy()
  })

  it('zeigt den Sammel-Gap eines ungesichteten Teilbaums statt vieler Einzelbefunde', () => {
    const sammel = createGap({
      type: 'teilbaum_ungesichtet',
      scope: 'folder',
      targetId: 'f-alt',
      targetName: 'Alt',
      folderId: 'f-alt',
      path: 'Alt',
      message: 'Ungesichteter Teilbaum — 42 Einzelbefund(e) zusammengefasst',
    })
    const tree = [node({ folderId: 'f-alt', name: 'Alt', path: 'Alt', bearbeitungsstand: 'ungesichtet', ampel: 'gelb', totalGaps: 1 })]
    render(<CoverageTree report={report(tree, [sammel])} />)
    expect(screen.getByText('Ungesichteter Teilbaum')).toBeTruthy()
    expect(screen.getByText(/42 Einzelbefund/)).toBeTruthy()
  })
})
