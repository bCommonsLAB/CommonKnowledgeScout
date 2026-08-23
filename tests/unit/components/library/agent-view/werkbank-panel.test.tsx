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

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { WerkbankPanel } from '@/components/library/agent-view/werkbank/werkbank-panel'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

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
  return render(
    <NuqsTestingAdapter searchParams={searchParams}>
      <WerkbankPanel report={r} />
    </NuqsTestingAdapter>,
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

  it('gewaehltes Vorhaben zeigt Kopf mit Name, Stand und W4-Hinweis', () => {
    const pilot = card('1. Arbeit/Pilot', { berichtTitel: 'Pilotprojekt Klima', berichtStatus: 'aktiv' })
    renderPanel(report([pilot]), `?vorhaben=${pilot.folderId}&filter=alle`)
    expect(screen.getAllByText('Pilotprojekt Klima').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Status: aktiv').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Welle W4/).length).toBeGreaterThan(0)
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
})
