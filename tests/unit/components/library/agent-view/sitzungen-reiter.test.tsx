// @vitest-environment jsdom

/**
 * @fileoverview Reiter „Sitzungen" der Agentensicht (Register, Welle R3).
 *
 * W8: Die Reiterleiste steht auch ohne Coverage-Report; nur die Report-Reiter
 * zeigen „Noch kein Scan". Der Reiter selbst liest nur seine Route
 * (`fetch` gestubbt) und zeigt Sicht-Zahlen, Gruppen und — mit `?sitzung=` —
 * das Detail samt „warum".
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@ks/ui'
import { bilanz } from '@/lib/agent-view/sitzungen-register/filter'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

vi.mock('@/hooks/agent-view/use-coverage-report', () => ({
  useCoverageReport: () => ({
    data: null, isLoading: false, isScanning: false, neverScanned: true, error: null, scanHinweis: null, scan: vi.fn(), reload: vi.fn(),
  }),
}))

import { AgentViewPanel } from '@/components/library/agent-view/agent-view-panel'

const ZEILE: SitzungsSicht = {
  registerId: 'k-1', sitzungId: 'k-1', kennung: 'voll', quelle: 'code_lokal', titel: 'Lokale Speicherung von Chatverläufen',
  beginn: '2026-11-03', ende: '2026-11-04', link: null, repo: 'CommonKnowledgeScout', branch: 'claude/x', prs: [], stand: 'notiz',
  hinweise: [], imBericht: false, berichtet: { chronikAm: '2026-11-15T12:00:00.000Z', blockAm: null },
  entscheidung: 'offen', entscheidungGrund: null, zugbereiche: [], vorhabenVorschlag: null, bemerkung: null,
  vorhabenPfad: '6. Lab/24.09 KnowledgeScout', vorhabenFolderId: 'f-ks', vorhabenBestimmt: true, belegOrdnerPfad: '6. Lab/24.09 KnowledgeScout',
  belege: [{ sourceId: 's-1', parentId: 'f-ks', name: '2026-11-03 Code Chatverläufe.md', zuege: '1-13', notiz: true, notizAktualisiert: '2026-11-04T12:00:00.000Z' }],
  gemeldetVon: 'archiv', gemeldetAm: '2026-11-15T10:00:00.000Z', gespeichert: true,
}

afterEach(() => cleanup())

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    if (String(url).includes('/agent-view/sitzungen')) {
      return new Response(JSON.stringify({ zeilen: [ZEILE], bilanz: bilanz([ZEILE]), imSpeicherGeprueft: 0, geladenAm: '2026-11-15T19:00:00.000Z' }), { status: 200 })
    }
    return new Response(JSON.stringify({ lists: [] }), { status: 200 })
  }))
})

function renderPanel(searchParams: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter searchParams={searchParams}>
        {/* In der App stellt das Root-Layout den TooltipProvider. */}
        <TooltipProvider>
          <AgentViewPanel libraryId="lib-1" />
        </TooltipProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  )
}

describe('Reiter „Sitzungen"', () => {
  it('Reiterleiste steht ohne Report; Report-Reiter sagen „Noch kein Scan"', () => {
    renderPanel('?tab=werkbank')
    expect(screen.getByRole('tab', { name: /Sitzungen/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Werkbank' }).getAttribute('data-state')).toBe('active')
    expect(screen.getByText('Noch kein Scan')).toBeTruthy()
  })

  it('ohne Report: Sicht-Zahlen und Gruppe aus der Sitzungs-Route', async () => {
    renderPanel('?tab=sitzungen')
    // WerkbankLayout rendert Desktop und Mobil (per CSS versteckt) — darum getAll.
    expect((await screen.findAllByRole('tab', { name: /Offen\s*1/ })).length).toBeGreaterThan(0)
    expect(screen.queryByText('Noch kein Scan')).toBeNull()
    expect(screen.getAllByRole('button', { name: /6\. Lab/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sitzung links wählen').length).toBeGreaterThan(0)
  })

  it('?sitzung= zeigt das Detail mit dem fehlenden Block als Grund', async () => {
    renderPanel('?tab=sitzungen&sitzung=k-1')
    expect((await screen.findAllByRole('heading', { name: 'Lokale Speicherung von Chatverläufen' })).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Noch nicht im Bericht').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/fehlt der erzeugte Block/).length).toBeGreaterThan(0)
  })
})
