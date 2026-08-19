// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ZyklusBoard } from '@/components/library/agent-view/zyklus-board'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function card(overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: 'f-pilot',
    name: '25.01 Pilot',
    path: '25.01 Pilot',
    bearbeitungsstand: 'abgenommen',
    bearbeitungsstandSeit: '2026-08-18T23:59:59.999Z',
    hasBericht: true,
    totalGaps: 0,
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    gapsByType: {},
    widerspruch: false,
    ...overrides,
  }
}

function report(vorhaben: VorhabenCard[]): CoverageReport {
  return {
    libraryId: 'lib-1',
    generatedAt: '2026-08-18T12:00:00.000Z',
    derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: 'standard-konzept',
      vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null,
      berichtFreshness: true,
      scanExcludeGlobs: [],
    },
    totals: {
      folders: 1, files: 0, sources: 0, twins: 0, gaps: 0,
      gapsByType: {}, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [],
    tree: [],
    vorhaben,
  }
}

describe('ZyklusBoard', () => {
  it('zeigt alle fuenf Staende plus die undeklarierten Ordner als Spalten', () => {
    render(<ZyklusBoard report={report([card()])} />)
    for (const label of ['Ungesichtet', 'Erschlossen', 'Strukturiert', 'Berichtet', 'Abgenommen', 'Ohne erklaerten Stand']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('macht den Widerspruchszustand sichtbar, ohne eine Datei anzufassen', () => {
    render(<ZyklusBoard report={report([card({ widerspruch: true, totalGaps: 2, gapsByActor: { mensch: 1, cowork: 1, knowledgescout: 0 } })])} />)
    expect(screen.getByText('Abgenommen, aber nicht mehr aktuell')).toBeTruthy()
    expect(screen.getByText(/2 Befunde · Mensch 1 · Cowork 1/)).toBeTruthy()
  })

  it('erklaert die Vorhaben-Erkennung, wenn kein Vorhaben gefunden wurde', () => {
    render(<ZyklusBoard report={report([])} />)
    expect(screen.getByText(/Kein Vorhaben erkannt/)).toBeTruthy()
  })
})
