// @vitest-environment jsdom

/**
 * @fileoverview Smoke-Test: Tab-Zustand der Agentensicht in der URL (W3).
 *
 * Der Tab kommt seit W3 aus `?tab=` (nuqs) statt aus einem unkontrollierten
 * `defaultValue`. Seit A7 oeffnet ohne Parameter die Tages-Uebersicht
 * „Aktuell" (die Werkbank bleibt ein Klick entfernt); `?tab=werkbank` und
 * `?tab=board` steuern weiterhin gezielt an — Deep-Links ueberstehen damit
 * Reload (v2-Akzeptanzkriterium 5).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CoverageReport } from '@/lib/agent-view/types'

const report: CoverageReport = {
  libraryId: 'lib-1',
  generatedAt: '2026-08-23T12:00:00.000Z',
  derived: true,
  scope: { folderId: null },
  conventions: {
    standardTemplate: null, vorhabenFolderPattern: null,
    indexRequiredMaxDepth: null, berichtFreshness: true, postfachMaxRueckstandWochen: null, scanExcludeGlobs: [],
  },
  totals: {
    folders: 1, files: 0, sources: 0, twins: 0, gaps: 0,
    gapsByType: {}, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
  },
  gaps: [],
  tree: [],
  vorhaben: [],
  families: [],
}

vi.mock('@/hooks/agent-view/use-coverage-report', () => ({
  useCoverageReport: () => ({
    data: { report, generatedAt: report.generatedAt, gapsTruncated: false, totalGaps: 0, delta: null, deltaHinweis: null },
    isLoading: false,
    isScanning: false,
    neverScanned: false,
    error: null,
    scan: vi.fn(),
  }),
}))

import { AgentViewPanel } from '@/components/library/agent-view/agent-view-panel'

afterEach(() => cleanup())

beforeEach(() => {
  // Werkbank-Tab laedt seit W6 die Worklists-Route beim Mount — stubben,
  // damit kein echter fetch ins Leere laeuft (frische Response je Aufruf).
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => new Response(JSON.stringify({ lists: [] }), { status: 200 })),
  )
})

function renderPanel(searchParams = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter searchParams={searchParams}>
        <AgentViewPanel libraryId="lib-1" />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  )
}

describe('AgentViewPanel — Tabs aus der URL', () => {
  it('ohne ?tab= oeffnet „Aktuell" (Default seit A7) mit allen fuenf Triggern', () => {
    renderPanel()
    for (const label of ['Aktuell', 'Werkbank', 'Baum', 'Zyklus-Board', 'Todos & Auftrag']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('tab', { name: 'Aktuell' }).getAttribute('data-state')).toBe('active')
    // Leerer Report → benannter Leerzustand der Sicht, kein stummer Bildschirm.
    expect(screen.getByText(/Noch keine Vorhaben mit Bericht/)).toBeTruthy()
  })

  it('?tab=werkbank oeffnet die Werkbank — der bestehende Deep-Link bleibt gueltig', () => {
    renderPanel('?tab=werkbank')
    expect(screen.getByRole('tab', { name: 'Werkbank' }).getAttribute('data-state')).toBe('active')
    // Werkbank-Inhalt (leerer Report → benannte Begruendung, kein stummer Zustand).
    expect(screen.getAllByText(/Kein Vorhaben im Report/).length).toBeGreaterThan(0)
  })

  it('?tab=board rendert das Zyklus-Board — der Deep-Link steuert den Tab', () => {
    renderPanel('?tab=board')
    expect(screen.getByRole('tab', { name: 'Zyklus-Board' }).getAttribute('data-state')).toBe('active')
    expect(screen.getByText(/Kein Vorhaben erkannt/)).toBeTruthy()
  })
})
