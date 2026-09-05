// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactElement } from 'react'
import { TodoListsPanel } from '@/components/library/agent-view/todo-lists-panel'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageGap, CoverageReport } from '@/lib/agent-view/types'

afterEach(() => cleanup())

// Seit W4 navigieren Todo-Zeilen via nuqs — der Testing-Adapter stellt den Kontext.
function renderPanel(ui: ReactElement, onUrlUpdate?: (event: UrlUpdateEvent) => void) {
  return render(<NuqsTestingAdapter searchParams="" onUrlUpdate={onUrlUpdate}>{ui}</NuqsTestingAdapter>)
}

function gap(type: CoverageGap['type'], path: string): CoverageGap {
  return createGap({ type, scope: 'folder', targetId: path, targetName: path, folderId: 'f', path, message: `Befund ${type}` })
}

function report(gaps: CoverageGap[]): CoverageReport {
  return {
    libraryId: 'lib-1',
    generatedAt: '2026-08-18T12:00:00.000Z',
    derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null, indexRequiredMaxDepth: null,
      berichtFreshness: true, postfachMaxRueckstandWochen: null, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1, files: 0, sources: 0, twins: 0, gaps: gaps.length,
      gapsByType: {}, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps,
    tree: [],
    vorhaben: [],
  }
}

const PROPS = { generatedAt: '2026-08-18T12:00:00.000Z', libraryLabel: 'Onedrive Test', localRootPath: null }

describe('TodoListsPanel', () => {
  it('zeigt die drei Akteur-Spalten mit Zaehlern und Zyklus-Schritten', () => {
    renderPanel(
      <TodoListsPanel
        report={report([gap('twin_flagged', 'a'), gap('report_missing', 'b'), gap('source_without_twin', 'c')])}
        {...PROPS}
      />,
    )
    expect(screen.getByText('Mensch')).toBeTruthy()
    expect(screen.getByText('Cowork')).toBeTruthy()
    expect(screen.getByText('KnowledgeScout')).toBeTruthy()
    expect(screen.getByText('Schritt 3 — Berichten')).toBeTruthy()
    expect(screen.getByText('Schritt 4 — Abnehmen')).toBeTruthy()
  })

  it('kopiert nach Auswahl einen Auftrag mit Rueckmeldungsblock in die Zwischenablage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderPanel(<TodoListsPanel report={report([gap('report_missing', '25.01 Pilot')])} {...PROPS} />)
    const button = screen.getByRole('button', { name: /Auftrag kopieren/ })
    expect(button.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(button.hasAttribute('disabled')).toBe(false)
    fireEvent.click(button)

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('# Cowork-Auftrag: Onedrive Test')
    expect(text).toContain('Konsistenz-Rueckmeldung (Pflicht)')
    expect(text).toContain('25.01 Pilot')
  })

  it('sagt es klar, wenn es nichts zu beauftragen gibt', () => {
    renderPanel(<TodoListsPanel report={report([])} {...PROPS} />)
    expect(screen.getByText(/nichts zu beauftragen/)).toBeTruthy()
  })

  it('Pfad-Klick navigiert ins Werkbank-Detail (?tab=werkbank&vorhaben=…, W4)', async () => {
    const onUrlUpdate = vi.fn()
    renderPanel(<TodoListsPanel report={report([gap('report_missing', '25.01 Pilot')])} {...PROPS} />, onUrlUpdate)
    fireEvent.click(screen.getByRole('button', { name: '25.01 Pilot' }))
    await vi.waitFor(() => {
      const letzter = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(letzter?.searchParams.get('tab')).toBe('werkbank')
      expect(letzter?.searchParams.get('vorhaben')).toBe('f')
    })
  })
})
