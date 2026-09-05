// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Leerzustand der Werkbank (Welle A1, Mockup C).
 *
 * Der Leerzustand beantwortet „was muss ich tun?" ohne Klick: betonte Karte
 * mit den wartenden VORHABEN, drei Akteur-Karten, Bestandszahlen als
 * Nebenzeile. Steht dort eine 0, nennt der Zustand den Grund.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WerkbankLeerzustand } from '@/components/library/agent-view/werkbank/werkbank-leerzustand'
import type { CoverageReport, GapCountByActor, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function karte(name: string, byActor: GapCountByActor): VorhabenCard {
  return {
    folderId: `f-${name}`, name, path: `4. Aktivismus/${name}`,
    bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null, hasBericht: true,
    totalGaps: byActor.mensch + byActor.cowork + byActor.knowledgescout,
    gapsByActor: byActor, gapsByType: {}, widerspruch: false,
    ampel: 'gelb', berichtTitel: null, berichtFileId: null,
    berichtModifiedAt: null, berichtStatus: null, themen: [],
  }
}

function report(vorhaben: VorhabenCard[]): CoverageReport {
  return {
    libraryId: 'lib-1', generatedAt: '2026-08-24T15:24:00.000Z', derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null, berichtFreshness: true, postfachMaxRueckstandWochen: null, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1100, files: 7263, sources: 98, twins: 135, gaps: 1694,
      gapsByType: {}, gapsByActor: { mensch: 32, cowork: 279, knowledgescout: 1383 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [], tree: [], vorhaben, families: [],
  }
}

describe('WerkbankLeerzustand (A1)', () => {
  it('nennt zuerst, wie viele Vorhaben auf den Menschen warten', () => {
    render(<WerkbankLeerzustand report={report([
      karte('Klima', { mensch: 28, cowork: 0, knowledgescout: 0 }),
      karte('SHF', { mensch: 2, cowork: 4, knowledgescout: 0 }),
    ])} />)
    const betont = screen.getByText('wartet auf dich').parentElement
    expect(betont?.textContent).toContain('1')
  })

  it('zeigt die drei Akteur-Karten mit den Library-Zahlen', () => {
    render(<WerkbankLeerzustand report={report([])} />)
    for (const [label, wert] of [['deine Punkte', '32'], ['Cowork', '279'], ['KnowledgeScout', '1383']]) {
      expect(screen.getByText(label).parentElement?.textContent).toContain(wert)
    }
  })

  it('traegt die Bestandszahlen als Nebenzeile, nicht als Hauptaussage', () => {
    render(<WerkbankLeerzustand report={report([])} />)
    expect(screen.getByText(/Archiv: 1100 Ordner · 7263 Dateien · 98 Quellen · 135 Artefakte/)).toBeTruthy()
  })

  it('begruendet eine 0 bei leerem Report statt sie stumm zu zeigen', () => {
    render(<WerkbankLeerzustand report={report([])} />)
    expect(screen.getByText(/kein Vorhaben erkannt/)).toBeTruthy()
  })

  it('begruendet eine 0, wenn ueberall noch maschinelle Befunde offen sind', () => {
    render(<WerkbankLeerzustand report={report([karte('SHF', { mensch: 2, cowork: 4, knowledgescout: 0 })])} />)
    expect(screen.getByText(/Kein Vorhaben ist bereit zur Abnahme/)).toBeTruthy()
  })
})
