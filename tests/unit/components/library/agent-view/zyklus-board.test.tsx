// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactElement } from 'react'
import { ZyklusBoard } from '@/components/library/agent-view/zyklus-board'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

// Seit W4 navigieren Board-Karten via nuqs — der Testing-Adapter stellt den Kontext.
function renderBoard(ui: ReactElement, onUrlUpdate?: (event: UrlUpdateEvent) => void) {
  return render(<NuqsTestingAdapter searchParams="" onUrlUpdate={onUrlUpdate}>{ui}</NuqsTestingAdapter>)
}

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
    // Werkbank-Felder (W1) — Karten frischer Scans tragen sie immer.
    ampel: 'gruen',
    berichtTitel: null,
    berichtFileId: null,
    berichtModifiedAt: null,
    berichtStatus: null,
    themen: [],
    ...overrides,
  }
}

/** Karte, wie sie ein GESPEICHERTER Report aus einem Scan vor W1 traegt (ohne Werkbank-Felder). */
function altKarte(): VorhabenCard {
  return {
    folderId: 'f-alt',
    name: 'Altbestand',
    path: 'Altbestand',
    bearbeitungsstand: 'abgenommen',
    bearbeitungsstandSeit: null,
    hasBericht: true,
    totalGaps: 0,
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    gapsByType: {},
    widerspruch: false,
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
    renderBoard(<ZyklusBoard report={report([card()])} />)
    for (const label of ['Ungesichtet', 'Erschlossen', 'Strukturiert', 'Berichtet', 'Abgenommen', 'Ohne erklaerten Stand']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('macht den Widerspruchszustand sichtbar, ohne eine Datei anzufassen', () => {
    renderBoard(<ZyklusBoard report={report([card({ widerspruch: true, totalGaps: 2, gapsByActor: { mensch: 1, cowork: 1, knowledgescout: 0 } })])} />)
    expect(screen.getByText('Abgenommen, aber nicht mehr aktuell')).toBeTruthy()
    expect(screen.getByText(/2 Befunde · Mensch 1 · Cowork 1/)).toBeTruthy()
  })

  it('erklaert die Vorhaben-Erkennung, wenn kein Vorhaben gefunden wurde', () => {
    renderBoard(<ZyklusBoard report={report([])} />)
    expect(screen.getByText(/Kein Vorhaben erkannt/)).toBeTruthy()
  })

  it('benennt Reports aus Scans vor Werkbank-W1 sichtbar, statt Titel/Status still wegzulassen', () => {
    renderBoard(<ZyklusBoard report={report([altKarte()])} />)
    expect(screen.getByText(/Scan vor Werkbank-Welle W1/)).toBeTruthy()
  })

  it('zeigt Bericht-Titel und -Status, sobald der Scan die W1-Felder gefuellt hat — ohne Alt-Hinweis', () => {
    renderBoard(<ZyklusBoard report={report([card({ berichtTitel: 'Pilotprojekt Klima', berichtStatus: 'aktiv' })])} />)
    expect(screen.getByText('Pilotprojekt Klima')).toBeTruthy()
    expect(screen.getByText('Status: aktiv')).toBeTruthy()
    expect(screen.queryByText(/Scan vor Werkbank-Welle W1/)).toBeNull()
  })

  it('Karten-Klick navigiert ins Werkbank-Detail (?tab=werkbank&vorhaben=…, W4)', async () => {
    const onUrlUpdate = vi.fn()
    renderBoard(<ZyklusBoard report={report([card()])} />, onUrlUpdate)
    fireEvent.click(screen.getByRole('button', { name: /25\.01 Pilot im Werkbank-Detail oeffnen/ }))
    await vi.waitFor(() => {
      const letzter = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(letzter?.searchParams.get('tab')).toBe('werkbank')
      expect(letzter?.searchParams.get('vorhaben')).toBe('f-pilot')
    })
  })
})
