// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: einzeiliger Seitenkopf der Agentensicht (Welle A1).
 *
 * Der Kopf traegt Scan-Zeitpunkt, „berechnet, nicht Wahrheit" und den
 * Fortschritt seit dem letzten Scan — und ausdruecklich NICHT mehr die acht
 * Kennzahlen, die Akteur-Chips und die Zyklus-Zeile (Mockup Zustand C). Fehlt
 * das Delta, steht der genannte Grund da statt eines stillen 0/0.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AgentViewKopf } from '@/components/library/agent-view/agent-view-kopf'
import type { CoverageResponse } from '@/hooks/agent-view/use-coverage-report'
import type { CoverageReport } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function report(overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    libraryId: 'lib-1', generatedAt: '2026-08-24T15:24:00.000Z', derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null, berichtFreshness: true, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1100, files: 7263, sources: 98, twins: 135, gaps: 1694,
      gapsByType: {}, gapsByActor: { mensch: 32, cowork: 279, knowledgescout: 1383 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [], tree: [], vorhaben: [], families: [],
    ...overrides,
  }
}

function antwort(overrides: Partial<CoverageResponse> = {}): CoverageResponse {
  const basis = report()
  return {
    report: basis, generatedAt: basis.generatedAt, gapsTruncated: false, totalGaps: basis.totals.gaps,
    delta: {
      vorherigerScan: '2026-08-23T10:00:00.000Z', erledigt: 2, neu: 1,
      erledigtNachTyp: {}, neuNachTyp: {},
    },
    deltaHinweis: null,
    ...overrides,
  }
}

function renderKopf(daten: CoverageResponse | null) {
  return render(<AgentViewKopf daten={daten} isLoading={false} isScanning={false} onScan={vi.fn()} />)
}

describe('AgentViewKopf — eine Zeile (A1)', () => {
  it('nennt Scan-Zeitpunkt, „berechnet, nicht Wahrheit" und das Delta', () => {
    renderKopf(antwort())
    expect(screen.getByText('Agentensicht')).toBeTruthy()
    expect(screen.getByText(/berechnet, nicht Wahrheit/)).toBeTruthy()
    expect(screen.getByText(/seit dem letzten Scan: 2 erledigt · 1 neu/)).toBeTruthy()
  })

  it('traegt weder Kennzahlen-Block noch Akteur-Chips noch Zyklus-Zeile', () => {
    renderKopf(antwort())
    expect(screen.queryByText('Wessen Arbeit?')).toBeNull()
    expect(screen.queryByText(/^Twin-Artefakte$/)).toBeNull()
    expect(screen.queryByText(/^zusammengefasst$/)).toBeNull()
    expect(screen.queryByText(/1 · Sichten:/)).toBeNull()
  })

  it('nennt den Grund, wenn es kein Delta gibt — kein stilles 0/0', () => {
    renderKopf(antwort({ delta: null, deltaHinweis: 'Erster Scan — kein Vergleich moeglich' }))
    expect(screen.getByText(/Erster Scan — kein Vergleich moeglich/)).toBeTruthy()
  })

  it('meldet Scan-Fehler laut in der Zeile', () => {
    const mitFehlern = report()
    mitFehlern.totals.scanErrors = 3
    renderKopf(antwort({ report: mitFehlern }))
    expect(screen.getByText(/3 Scan-Fehler/)).toBeTruthy()
  })

  it('zeigt ohne Report nur Titel und Scan-Knopf — der Grund steht als Alert im Panel', () => {
    renderKopf(null)
    expect(screen.getByText('Agentensicht')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Neu scannen/ })).toBeTruthy()
    expect(screen.queryByText(/berechnet, nicht Wahrheit/)).toBeNull()
  })
})
