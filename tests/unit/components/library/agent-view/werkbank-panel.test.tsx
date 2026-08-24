// @vitest-environment jsdom

/**
 * @fileoverview UI-Smoke- und Leerzustand-Tests der Werkbank (F6, Welle W3).
 *
 * Der Virtualizer rendert im jsdom (Hoehe 0) keine Zeilen — geprueft werden
 * darum die BENANNTEN Zustaende: Leer-Begruendungen (Akzeptanzkriterium 4),
 * Alt-Report-Hinweis, Detail-Platzhalter (nichts gewaehlt · unbekannt ·
 * gewaehlt) und die Filterleiste mit „Zu tun" als Default. Die Zeilen selbst
 * testet `vorhaben-zeile.test.tsx` isoliert.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WerkbankPanel } from '@/components/library/agent-view/werkbank/werkbank-panel'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

/** Antworten je Route: Bericht (W2) immer „kein Bericht", Worklists (W6) stubbar. */
function stubRouten(lists: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (eingabe: RequestInfo | URL) => {
      const url = String(eingabe)
      if (url.includes('/agent-view/worklists')) {
        return new Response(JSON.stringify({ lists }), { status: 200 })
      }
      return new Response(JSON.stringify({ bericht: null, grund: 'kein_bericht' }), { status: 200 })
    }),
  )
}

beforeEach(() => stubRouten())

function card(path: string, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: `f-${path}`,
    name: path.split('/').pop() ?? path,
    path,
    bearbeitungsstand: 'erschlossen',
    bearbeitungsstandSeit: null,
    hasBericht: false,
    totalGaps: 0,
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    gapsByType: {},
    widerspruch: false,
    ampel: 'gruen',
    berichtTitel: null,
    berichtFileId: null,
    berichtModifiedAt: null,
    berichtStatus: null,
    themen: [],
    ...overrides,
  }
}

function report(vorhaben: VorhabenCard[], overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    libraryId: 'lib-1',
    generatedAt: '2026-08-23T12:00:00.000Z',
    derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null, berichtFreshness: true, scanExcludeGlobs: [],
    },
    totals: {
      folders: 12, files: 34, sources: 5, twins: 4, gaps: 0,
      gapsByType: {}, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [],
    tree: [],
    vorhaben,
    families: [],
    ...overrides,
  }
}

function renderPanel(r: CoverageReport, searchParams = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter searchParams={searchParams}>
        <WerkbankPanel report={r} generatedAt={r.generatedAt} libraryLabel="Testarchiv" localRootPath={null} />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  )
}

describe('WerkbankPanel — Leerzustaende (Akzeptanzkriterium 4)', () => {
  it('erklaert die Vorhaben-Erkennung bei leerem Report', () => {
    renderPanel(report([]))
    expect(screen.getAllByText(/Kein Vorhaben im Report/).length).toBeGreaterThan(0)
  })

  it('Default „Zu tun": lauter gruene Vorhaben ergeben eine benannte Begruendung, keine stumme Flaeche', () => {
    renderPanel(report([card('1. Arbeit/Pilot'), card('2. Privat/Steuer')]))
    expect(screen.getAllByText(/Nichts zu tun: alle 2 Vorhaben sind gruen/).length).toBeGreaterThan(0)
  })

  it('Suche ohne Treffer nennt Suchtext und Gesamtzahl', () => {
    renderPanel(report([card('1. Arbeit/Pilot')]), '?filter=alle&q=klima')
    expect(screen.getAllByText(/Suche „klima"/).length).toBeGreaterThan(0)
  })

  it('benennt Reports aus Scans vor W1 sichtbar (Banner + nicht auswertbarer Filter)', () => {
    const { ampel: _a, berichtTitel: _t, berichtFileId: _f, berichtModifiedAt: _m, berichtStatus: _s, themen: _th, ...alt } = card('3. Alt/Archiv')
    renderPanel(report([alt]))
    expect(screen.getAllByText(/Scan vor Werkbank-Welle W1/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/nicht auswertbar/).length).toBeGreaterThan(0)
  })
})

describe('WerkbankPanel — Detail-Platzhalter', () => {
  it('ohne Auswahl: Aufforderung + Library-Totalen', () => {
    renderPanel(report([card('1. Arbeit/Pilot')]))
    expect(screen.getAllByText(/Vorhaben links waehlen/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/12 Ordner · 34 Dateien/).length).toBeGreaterThan(0)
  })

  it('gewaehlte folderId ohne Karte im Report: „Nicht im letzten Scan"', () => {
    renderPanel(report([card('1. Arbeit/Pilot')]), '?vorhaben=f-geloescht')
    expect(screen.getAllByText(/Nicht im letzten Scan/).length).toBeGreaterThan(0)
  })

  it('gewaehltes Vorhaben zeigt das EINE Dokument: Kopf + Tabs Bericht/Ordner-Beschreibung (A3)', () => {
    const pilot = card('1. Arbeit/Pilot', { berichtTitel: 'Pilotprojekt Klima', berichtStatus: 'aktiv' })
    renderPanel(report([pilot]), `?vorhaben=${pilot.folderId}&filter=alle`)
    expect(screen.getAllByRole('tab', { name: 'Bericht' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('tab', { name: 'Ordner-Beschreibung' }).length).toBeGreaterThan(0)
    // Die gestapelten Bloecke sind aufgeloest (Mockup-Leitidee: EIN Dokument).
    expect(screen.queryByText('Befunde des Teilbaums')).toBeNull()
    expect(screen.queryByText('Twin-Familien')).toBeNull()
  })
})

describe('WerkbankPanel — Filterleiste', () => {
  it('„Zu tun" ist der Default-Zustand des Segmented-Umschalters', () => {
    renderPanel(report([card('1. Arbeit/Pilot')]))
    const zuTun = screen.getAllByRole('button', { name: 'Zu tun' })
    expect(zuTun[0].getAttribute('aria-pressed')).toBe('true')
    const alle = screen.getAllByRole('button', { name: 'Alle' })
    expect(alle[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('Filter „Liste ▾" ohne gewaehlte Liste nennt den Grund (W6, Akzeptanzkriterium 4)', async () => {
    renderPanel(report([card('1. Arbeit/Pilot')]), '?filter=liste')
    expect((await screen.findAllByText(/Keine Arbeitsliste gewaehlt/)).length).toBeGreaterThan(0)
  })

  it('aktive Liste zeigt Fortschrittskopf und tote Eintraege sichtbar (W6, F7)', async () => {
    stubRouten([
      {
        listId: 'l-1', name: 'Aktuelle Projekte', position: 0,
        folders: [
          { folderId: 'f-1. Arbeit/Pilot', pathSnapshot: '1. Arbeit/Pilot', name: 'Pilot', addedAt: 'x' },
          { folderId: 'f-weg', pathSnapshot: 'Alt/Geloescht', name: 'Geloescht', addedAt: 'x' },
        ],
      },
    ])
    renderPanel(report([card('1. Arbeit/Pilot')]), '?filter=liste&liste=l-1')
    expect((await screen.findAllByText(/0 von 1 abgenommen/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Nicht im letzten Scan \(1\)/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Alt\/Geloescht/).length).toBeGreaterThan(0)
  })

  it('Gruppierung: „Bereich" ist Default, ?gruppierung=thema steuert per Deep-Link (F12, W5)', () => {
    renderPanel(report([card('1. Arbeit/Pilot')]))
    expect(screen.getAllByRole('button', { name: 'Bereich' })[0].getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('button', { name: 'Thema' })[0].getAttribute('aria-pressed')).toBe('false')
    cleanup()
    renderPanel(report([card('1. Arbeit/Pilot')]), '?gruppierung=thema')
    expect(screen.getAllByRole('button', { name: 'Thema' })[0].getAttribute('aria-pressed')).toBe('true')
  })
})
