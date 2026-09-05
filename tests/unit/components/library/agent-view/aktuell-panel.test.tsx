// @vitest-environment jsdom

/**
 * @fileoverview Smoke-Test: Aktuell-Panel (Welle A7).
 *
 * Geprueft wird, was die Sicht gegenueber der exportierten `AKTUELL.md`
 * ausmacht: Sie zeigt Termine und aktive Vorhaben aus dem gespeicherten
 * Report OHNE eigenen Fetch, benennt Ueberfaelligkeit sichtbar, und jede
 * Zeile ist ein Einstieg — ein Klick fuehrt ins Werkbank-Detail
 * (`?tab=werkbank&vorhaben=…&filter=alle`).
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactElement } from 'react'
import { AktuellPanel } from '@/components/library/agent-view/aktuell/aktuell-panel'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function renderPanel(ui: ReactElement, onUrlUpdate?: (event: UrlUpdateEvent) => void) {
  return render(<NuqsTestingAdapter searchParams="" onUrlUpdate={onUrlUpdate}>{ui}</NuqsTestingAdapter>)
}

function karte(name: string, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: `f-${name}`,
    name,
    path: `4. Ökosozialer Aktivismus/${name}`,
    bearbeitungsstand: 'berichtet',
    bearbeitungsstandSeit: null,
    hasBericht: true,
    totalGaps: 0,
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    gapsByType: {},
    widerspruch: false,
    ampel: 'gruen',
    berichtTitel: name,
    berichtFileId: `file-${name}`,
    berichtModifiedAt: '2026-09-01T10:00:00.000Z',
    berichtStatus: 'aktiv',
    themen: [],
    gepflegteThemen: [],
    berichtRolle: 'anwendung',
    berichtLetzteAktivitaet: '2026-08-29',
    berichtNaechsterTermin: null,
    berichtTerminFixiert: true,
    berichtOffenePunkte: [],
    berichtOffeneAnzahl: 0,
    postfachAb: null,
    postfachBis: null,
    ...overrides,
  }
}

function report(vorhaben: VorhabenCard[], postfachMaxRueckstandWochen: number | null = null): CoverageReport {
  return {
    libraryId: 'lib-1',
    generatedAt: '2026-09-04T18:00:00.000Z',
    derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null, indexRequiredMaxDepth: null,
      berichtFreshness: true, postfachMaxRueckstandWochen, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1, files: 0, sources: 0, twins: 0, gaps: 0,
      gapsByType: {}, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [],
    tree: [],
    vorhaben,
    families: [],
  }
}

const GENERATED_AT = '2026-09-04T18:00:00.000Z'

describe('AktuellPanel', () => {
  it('zeigt Termine, aktive Vorhaben und offene Punkte aus dem Report', () => {
    renderPanel(
      <AktuellPanel
        report={report([
          karte('26.07 Naturmuseum', {
            berichtNaechsterTermin: '2026-09-24',
            berichtOffenePunkte: ['Subdomain benennen'],
            berichtOffeneAnzahl: 3,
          }),
        ])}
        generatedAt={GENERATED_AT}
      />,
    )
    expect(screen.getAllByText('24. September 2026').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: '26.07 Naturmuseum' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Subdomain benennen')).toBeTruthy()
    // Kappung wird gesagt, nicht still abgeschnitten.
    expect(screen.getByText('+2 weitere im Bericht')).toBeTruthy()
  })

  it('markiert einen vergangenen Termin sichtbar als ueberfaellig', () => {
    renderPanel(
      <AktuellPanel
        report={report([karte('26.02 AECED', { berichtNaechsterTermin: '2020-01-31' })])}
        generatedAt={GENERATED_AT}
      />,
    )
    expect(screen.getAllByText('überfällig').length).toBeGreaterThan(0)
  })

  it('fuehrt ruhende Vorhaben getrennt und nennt die Abdeckungsluecke', () => {
    renderPanel(
      <AktuellPanel
        report={report([
          karte('Aktiv'),
          karte('Ruhend', { berichtStatus: 'ruhend' }),
          karte('Ohne', { hasBericht: false, berichtStatus: null, berichtFileId: null }),
        ])}
        generatedAt={GENERATED_AT}
      />,
    )
    expect(screen.getByText(/Ruhend und abgeschlossen/)).toBeTruthy()
    expect(screen.getByText(/2 Vorhaben/)).toBeTruthy()
    expect(screen.getByText(/1 nicht/)).toBeTruthy()
  })

  it('Klick auf ein Vorhaben oeffnet das Werkbank-Detail mit Filter „alle"', async () => {
    const onUrlUpdate = vi.fn()
    renderPanel(
      <AktuellPanel report={report([karte('26.05 SHF')])} generatedAt={GENERATED_AT} />,
      onUrlUpdate,
    )
    fireEvent.click(screen.getAllByRole('button', { name: '26.05 SHF' })[0])
    await vi.waitFor(() => {
      const letzter = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(letzter?.searchParams.get('tab')).toBe('werkbank')
      expect(letzter?.searchParams.get('vorhaben')).toBe('f-26.05 SHF')
      // Ohne `filter=alle` stuende das Vorhaben nicht in der Werkbank-Liste
      // (Default-Filter „bereit").
      expect(letzter?.searchParams.get('filter')).toBe('alle')
    })
  })

  it('A7b: mahnt sichtbar, wenn ein Postfach ueber der Schwelle liegt', () => {
    // Die Sicht misst gegen den echten heutigen Tag — ein Rueckstand aus 2020
    // liegt unter jeder Schwelle sicher darueber.
    renderPanel(
      <AktuellPanel
        report={report([karte('26.07 Naturmuseum', { postfachBis: '2020-KW01' })], 2)}
        generatedAt={GENERATED_AT}
      />,
    )
    expect(screen.getByText(/wartet auf seine E-Mail-Auswertung/)).toBeTruthy()
    expect(screen.getAllByText(/Postfach bis KW 1\/2020/).length).toBeGreaterThan(0)
  })

  it('A7b: ohne konfigurierte Schwelle mahnt die Sicht nicht', () => {
    renderPanel(
      <AktuellPanel
        report={report([karte('26.07 Naturmuseum', { postfachBis: '2020-KW01' })], null)}
        generatedAt={GENERATED_AT}
      />,
    )
    expect(screen.queryByText(/E-Mail-Auswertung/)).toBeNull()
    // Der Stand steht trotzdem an der Zeile — nur gemahnt wird nicht.
    expect(screen.getAllByText(/Postfach bis KW 1\/2020/).length).toBeGreaterThan(0)
  })

  it('A7b: ohne postfach_bis bleibt die Zeile ganz weg', () => {
    renderPanel(<AktuellPanel report={report([karte('Ohne Feld')], 2)} generatedAt={GENERATED_AT} />)
    expect(screen.queryByText(/Postfach/)).toBeNull()
  })
})
