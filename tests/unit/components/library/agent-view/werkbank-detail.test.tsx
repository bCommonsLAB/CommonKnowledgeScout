// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Werkbank-Detail (F9, Welle W4).
 *
 * Geprueft werden die benannten Zustaende des Details: Bericht-Render ueber
 * die W2-Route mit der BESTEHENDEN MarkdownPreview (Happy-Path), `zu_gross`
 * mit Archiv-Verweis, „veraltet"-Badge aus dem Report, die „Bereit zur
 * Abnahme"-Leiste, der Kappungshinweis der Befundliste, der
 * Vor-Welle-4-Hinweis der Familien und der Vorhaben-Auftrag (Clipboard).
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WerkbankDetail } from '@/components/library/agent-view/werkbank/werkbank-detail'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageGap, CoverageReport, CoverageTreeNode, VorhabenCard } from '@/lib/agent-view/types'
import type { BerichtAntwort } from '@/lib/agent-view/bericht-laden'

afterEach(() => cleanup())

function antwort(overrides: Partial<BerichtAntwort> = {}): BerichtAntwort {
  return { bericht: null, grund: 'kein_bericht', ...overrides }
}

function stubBericht(data: BerichtAntwort) {
  // Pro Aufruf eine FRISCHE Response (Bodies sind einmal lesbar) und URL-Routing:
  // das Detail fragt seit W6 auch die Worklists-Route (ZuListeKnopf), seit W7
  // schreibt es ueber die Stand-Route (StandAktionen).
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (eingabe: RequestInfo | URL) => {
      if (String(eingabe).includes('/agent-view/worklists')) {
        return new Response(JSON.stringify({ lists: [] }), { status: 200 })
      }
      if (String(eingabe).includes('/agent-view/stand')) {
        return new Response(
          JSON.stringify({ stand: { bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: '2026-08-24T23:59:59.999Z' } }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify(data), { status: 200 })
    }),
  )
}

beforeEach(() => stubBericht(antwort()))

function gapAt(path: string, folderId: string, type: CoverageGap['type']): CoverageGap {
  return createGap({ type, scope: 'folder', targetId: folderId, targetName: path, folderId, path, message: 'Test' })
}

function karte(overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: 'f-pilot', name: 'Pilot', path: '1. Arbeit/Pilot',
    bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null, hasBericht: true,
    totalGaps: 1, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
    gapsByType: { twin_unverified: 1 }, widerspruch: false,
    ampel: 'rot', berichtTitel: 'Pilotbericht', berichtFileId: 'id-b1',
    berichtModifiedAt: null, berichtStatus: 'aktiv', themen: [],
    ...overrides,
  }
}

function knoten(path: string, overrides: Partial<CoverageTreeNode> = {}): CoverageTreeNode {
  return {
    folderId: `f-${path}`, name: path.split('/').pop() ?? '', path, depth: path.split('/').length,
    bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: true, hasBericht: true,
    sourceCount: 2, fileCount: 3, ownGaps: 0, totalGaps: 0, gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, ampel: 'gruen', children: [],
  }
}

function report(overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    libraryId: 'lib-1', generatedAt: '2026-08-23T12:00:00.000Z', derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null, berichtFreshness: true, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1, files: 3, sources: 2, twins: 1, gaps: 1,
      gapsByType: {}, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [gapAt('1. Arbeit/Pilot', 'f-pilot', 'twin_unverified')],
    // Pilot-Knoten traegt die folderId der Karte — die Fusszeile findet ihn darueber.
    tree: [{ ...knoten('1. Arbeit'), children: [{ ...knoten('1. Arbeit/Pilot'), folderId: 'f-pilot' }] }],
    vorhaben: [karte()],
    families: [],
    ...overrides,
  }
}

function renderDetail(r: CoverageReport, k: VorhabenCard | null = karte(), vorhabenId: string | null = 'f-pilot') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <WerkbankDetail
        karte={k}
        vorhabenId={vorhabenId}
        report={r}
        generatedAt={r.generatedAt}
        libraryLabel="Testarchiv"
        localRootPath={null}
      />
    </QueryClientProvider>,
  )
}

describe('WerkbankDetail — Bericht (W2-Route + bestehende MarkdownPreview)', () => {
  it('rendert den Bericht-Body mit der bestehenden MarkdownPreview (Happy-Path)', async () => {
    stubBericht(antwort({
      grund: undefined,
      bericht: {
        fileId: 'id-b1', name: 'BERICHT.md', modifiedAt: '2026-08-21T07:30:00.000Z', sizeBytes: 100,
        body: '# Pilotbericht\n\nInhalt aus dem Archiv.',
        kopf: { titel: 'Pilotbericht', ersterAbsatz: 'Inhalt aus dem Archiv.', offenePunkte: [] },
      },
    }))
    renderDetail(report())
    expect(await screen.findByText('Inhalt aus dem Archiv.')).toBeTruthy()
    expect(screen.getByText('BERICHT.md')).toBeTruthy()
  })

  it('zu_gross verweist ins Archiv statt abgeschnittener Vorschau', async () => {
    stubBericht(antwort({
      grund: 'zu_gross',
      bericht: {
        fileId: 'id-b1', name: 'BERICHT.md', modifiedAt: null, sizeBytes: 600 * 1024,
        body: null, kopf: null,
      },
    }))
    renderDetail(report())
    expect(await screen.findByText(/zu gross fuer die Vorschau/)).toBeTruthy()
    expect(screen.getAllByText(/im Archiv oeffnen/).length).toBeGreaterThan(0)
  })

  it('traegt das „veraltet"-Badge, wenn der Report bericht_veraltet am Vorhaben meldet', async () => {
    stubBericht(antwort({
      grund: undefined,
      bericht: {
        fileId: 'id-b1', name: 'BERICHT.md', modifiedAt: null, sizeBytes: 10,
        body: '# Pilotbericht', kopf: { titel: 'Pilotbericht', ersterAbsatz: '', offenePunkte: [] },
      },
    }))
    const r = report({
      gaps: [gapAt('1. Arbeit/Pilot', 'f-pilot', 'bericht_veraltet')],
    })
    renderDetail(r)
    expect(await screen.findByText('veraltet')).toBeTruthy()
  })

  it('kein_bericht ist ein Cowork-Befund mit Auftrags-Hinweis, kein Fehler', async () => {
    renderDetail(report())
    expect(await screen.findByText('Kein BERICHT.md')).toBeTruthy()
    expect(screen.getByText(/Auftrag\s+fuer dieses Vorhaben kopieren/)).toBeTruthy()
  })
})

describe('WerkbankDetail — Kopf, Befunde, Familien, Fusszeile', () => {
  it('zeigt die „Bereit zur Abnahme"-Leiste nur beim geteilten Praedikat', () => {
    renderDetail(report())
    expect(screen.getByText(/Bereit zur Abnahme — keine maschinellen Befunde offen/)).toBeTruthy()
    cleanup()
    renderDetail(report(), karte({ gapsByActor: { mensch: 1, cowork: 1, knowledgescout: 0 } }))
    expect(screen.queryByText(/Bereit zur Abnahme — keine/)).toBeNull()
  })

  it('weist die Kappung aus, wenn der Report mehr Befunde zaehlt als er listet', () => {
    renderDetail(report(), karte({ totalGaps: 5 }))
    expect(screen.getByText(/4 weitere Befunde sind gezaehlt, aber nicht gelistet/)).toBeTruthy()
  })

  it('benennt Reports vor Welle 4 im Familien-Abschnitt statt still leer zu bleiben', () => {
    renderDetail(report({ families: undefined }))
    expect(screen.getByText(/Scan vor Welle 4/)).toBeTruthy()
  })

  it('kopiert den Vorhaben-Auftrag der Cowork-Gruppe in die Zwischenablage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const r = report({ gaps: [gapAt('1. Arbeit/Pilot', 'f-pilot', 'report_missing')] })
    renderDetail(r, karte({ gapsByType: { report_missing: 1 }, gapsByActor: { mensch: 0, cowork: 1, knowledgescout: 0 } }))
    fireEvent.click(screen.getByRole('button', { name: /Auftrag kopieren \(dieses Vorhaben\)/ }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Cowork-Auftrag: Testarchiv')
    expect(writeText.mock.calls[0][0]).toContain('1. Arbeit/Pilot')
  })

  it('Abnehmen (W7) ueberlagert den Stand lokal und sagt dazu, dass der Report alt ist', async () => {
    renderDetail(report())
    fireEvent.click(screen.getByRole('button', { name: 'Abnehmen' }))
    expect(await screen.findByText(/Report zeigt noch den alten Scan/)).toBeTruthy()
    expect(screen.getByText('Abgenommen')).toBeTruthy()
    expect(screen.getByText(/seit 2026-08-24/)).toBeTruthy()
  })

  it('Fusszeile summiert Quellen/Dateien des Teilbaums und bietet die folderId an', () => {
    renderDetail(report())
    expect(screen.getByText(/2 Quellen · 3 Dateien im Teilbaum/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /folderId kopieren/ })).toBeTruthy()
  })
})
