// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Abnahme-Kopf des Vorhabens (Welle A4).
 *
 * Portiert die Stand-Aktionen-Tests (W7) auf den einheitlichen Kopf:
 * „Vorhaben abnehmen" sperrt NUR bei Maschinen-Befunden (Entscheidung 6),
 * das Stand-Menue wohnt im `⋯`-Menue ohne `abgenommen`-Option, Fehler-
 * und Override-Hinweise stehen benannt unter den zwei Zeilen. Dazu A4:
 * Fortschritts-Chip `n von m geprueft` und die Sammelaktion mit
 * Rueckfrage, die die Zahl nennt (Entscheidung 3).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VorhabenKopf } from '@/components/library/agent-view/werkbank/vorhaben-kopf'
import type { UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'
import type { StandFehler, StandOverride, UseStandResult } from '@/hooks/agent-view/use-stand'
import type { CoverageGap, LeadingArtifactSummary, TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

beforeEach(() => {
  // ZuListeKnopf im Menue laedt die Worklists-Route.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ lists: [] }), { status: 200 })))
})

function karte(overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: 'f-pilot', name: 'Pilot', path: '1. Arbeit/Pilot',
    bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null, hasBericht: true,
    totalGaps: 1, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
    gapsByType: { stand_widerspruch: 1 }, widerspruch: false,
    ampel: 'gelb', berichtTitel: null, berichtFileId: null,
    berichtModifiedAt: null, berichtStatus: null, themen: [],
    ...overrides,
  }
}

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    verification: 'unverifiziert', ...overrides,
  }
}

function familie(sourceId: string, overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return {
    sourceId, sourceName: `${sourceId}.m4a`, folderId: 'f-pilot', path: `1. Arbeit/Pilot/${sourceId}.m4a`,
    artifactCount: 2, leading: artefakt(),
    transkript: artefakt(), zusammenfassung: null,
    ...overrides,
  }
}

function fakeStand(overrides: {
  setzeStand?: ReturnType<typeof vi.fn>
  override?: StandOverride
  fehler?: StandFehler
  pending?: boolean
} = {}): UseStandResult {
  return {
    overrides: new Map(overrides.override ? [['f-pilot', overrides.override]] : []),
    pendingFolderId: overrides.pending ? 'f-pilot' : null,
    fehlerByFolder: new Map(overrides.fehler ? [['f-pilot', overrides.fehler]] : []),
    setzeStand: overrides.setzeStand ?? vi.fn().mockResolvedValue(undefined),
  }
}

function fakeThemen() {
  return {
    overrides: new Map<string, string[]>(),
    pendingFolderId: null,
    fehlerByFolder: new Map<string, string>(),
    setzeThemen: vi.fn().mockResolvedValue(true),
  }
}

function fakeKuration(overrides: Partial<UseArtefaktKurationResult> = {}): UseArtefaktKurationResult {
  return {
    overrides: new Map(), pendingKey: null, fehler: new Map(),
    verifiziere: vi.fn().mockResolvedValue(null),
    markiere: vi.fn().mockResolvedValue(null),
    setzeTwinStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderKopf(args: {
  k?: VorhabenCard
  stand?: UseStandResult
  familien?: TwinFamilySummary[] | undefined
  kuration?: UseArtefaktKurationResult
  befunde?: CoverageGap[]
  onWaehleArtefakt?: ReturnType<typeof vi.fn>
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onWaehleArtefakt = args.onWaehleArtefakt ?? vi.fn()
  const ergebnis = render(
    <QueryClientProvider client={queryClient}>
      <VorhabenKopf
        karte={args.k ?? karte()}
        stand={args.stand ?? fakeStand()}
        generatedAt="G1"
        libraryId="lib-1"
        familien={'familien' in args ? args.familien : []}
        kuration={args.kuration ?? fakeKuration()}
        themenVokabular={[]}
        themenHook={fakeThemen()}
        befunde={args.befunde ?? []}
        onWaehleArtefakt={onWaehleArtefakt}
        auftragContext={{ libraryLabel: 'Testarchiv', localRootPath: null, generatedAt: 'G1' }}
      />
    </QueryClientProvider>,
  )
  return Object.assign(ergebnis, { onWaehleArtefakt })
}

describe('VorhabenKopf — primaerer Knopf (Entscheidung 6)', () => {
  it('ist beim geteilten Praedikat aktiv und beurkundet mit erwartetem Stand + Report-Stand', () => {
    const setzeStand = vi.fn().mockResolvedValue(undefined)
    renderKopf({ stand: fakeStand({ setzeStand }) })
    const knopf = screen.getByRole('button', { name: 'Vorhaben abnehmen' })
    expect(knopf.hasAttribute('disabled')).toBe(false)
    fireEvent.click(knopf)
    expect(setzeStand).toHaveBeenCalledWith({
      folderId: 'f-pilot', stand: 'abgenommen', erwarteterStand: 'berichtet',
      reportGeneratedAt: 'G1', bestaetigen: false,
    })
  })

  it('sperrt NUR bei Maschinen-Befunden — der Tooltip nennt die Blocker', () => {
    renderKopf({ k: karte({ gapsByActor: { mensch: 0, cowork: 1, knowledgescout: 2 } }) })
    expect(screen.getByRole('button', { name: 'Vorhaben abnehmen' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTitle(/1 Cowork-Befund und 2 KnowledgeScout-Befunde offen/)).toBeTruthy()
  })

  it('ist nach der Abnahme deaktiviert und verweist auf „Stand bestaetigen"', () => {
    renderKopf({ stand: fakeStand({ override: { bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: null } }) })
    expect(screen.getByRole('button', { name: 'Vorhaben abnehmen' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTitle(/Bereits abgenommen/)).toBeTruthy()
  })
})

describe('VorhabenKopf — Menue ⋯ (alles Seltene)', () => {
  it('traegt das Stand-Menue ohne abgenommen-Option; bestaetigen sendet bestaetigen: true', () => {
    const setzeStand = vi.fn().mockResolvedValue(undefined)
    renderKopf({ stand: fakeStand({ setzeStand }) })
    fireEvent.click(screen.getByRole('button', { name: 'Menue zu Pilot' }))
    const optionen = [...screen.getByLabelText('Stand-Menue').querySelectorAll('option')].map(
      (option) => option.getAttribute('value'),
    )
    expect(optionen).toEqual(['', 'bestaetigen', 'ungesichtet', 'erschlossen', 'strukturiert'])
    fireEvent.change(screen.getByLabelText('Stand-Menue'), { target: { value: 'bestaetigen' } })
    expect(setzeStand).toHaveBeenCalledWith(
      expect.objectContaining({ stand: 'berichtet', erwarteterStand: 'berichtet', bestaetigen: true }),
    )
  })

  it('traegt Archiv-Link, folderId kopieren und „Befunde & Auftrag"', () => {
    renderKopf()
    fireEvent.click(screen.getByRole('button', { name: 'Menue zu Pilot' }))
    expect(screen.getByText(/Im Archiv oeffnen/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /folderId kopieren/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Befunde & Auftrag/ }))
    expect(screen.getByText('Befunde des Teilbaums')).toBeTruthy()
  })
})

describe('VorhabenKopf — Zeile 2: Widerstands-Chip (ADR 0006)', () => {
  it('sagt „keine Widerstaende", wenn nichts sperrt — auch ohne jede Verifikation', () => {
    renderKopf({
      familien: [familie('a'), familie('b')],
      k: { ...karte(), gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {} },
    })
    expect(screen.getByText('keine Widerstaende')).toBeTruthy()
  })

  it('zaehlt maschinelle Befunde und Fehler-Markierungen zusammen', () => {
    renderKopf({
      familien: [familie('a', { transkript: artefakt({ twinStatus: 'flagged' }) }), familie('b')],
      k: {
        ...karte(),
        gapsByActor: { mensch: 1, cowork: 2, knowledgescout: 0 },
        gapsByType: { twin_flagged: 1, report_missing: 2 },
      },
    })
    expect(screen.getByText('3 Widerstaende offen')).toBeTruthy()
  })

  it('nennt im Titel die Herkunft der Sperre und was ein Mensch angesehen hat', () => {
    renderKopf({
      familien: [familie('a', { transkript: artefakt({ twinStatus: 'flagged' }) })],
      k: { ...karte(), gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 }, gapsByType: { twin_flagged: 1 } },
    })
    expect(screen.getByRole('button', { name: /1 Widerstand offen/ }).getAttribute('title')).toContain(
      'als fehlerhaft markiert',
    )
  })

  it('der Chip klappt auf und nennt die maschinellen Befunde beim Namen (Befund 27.08.2026)', () => {
    renderKopf({
      k: { ...karte(), gapsByActor: { mensch: 0, cowork: 2, knowledgescout: 0 }, gapsByType: { report_missing: 2 } },
      befunde: [
        { type: 'report_missing', actor: 'cowork', severity: 'warning', path: '1. Arbeit/Pilot', message: 'Kein BERICHT.md', scope: 'folder', targetId: 'f-pilot', targetName: 'Pilot', folderId: 'f-pilot', zyklusSchritt: 3 } as unknown as CoverageGap,
      ],
    })
    // Zugeklappt ist nichts davon sichtbar — erst der Klick loest die Zahl auf.
    expect(screen.queryByText(/Kein BERICHT.md/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2 Widerstaende offen/ }))
    expect(screen.getByText(/Kein BERICHT.md/)).toBeTruthy()
  })

  it('sagt je Befund, WAS zu tun ist und WER dran ist (Rueckfrage 27.08.2026)', () => {
    renderKopf({
      k: { ...karte(), gapsByActor: { mensch: 0, cowork: 1, knowledgescout: 0 }, gapsByType: { report_missing: 1 } },
      befunde: [
        { type: 'report_missing', actor: 'cowork', severity: 'warning', path: '1. Arbeit/Pilot', message: 'Kein BERICHT.md', scope: 'folder', targetId: 'f-pilot', targetName: 'Pilot', folderId: 'f-pilot', zyklusSchritt: 3 } as unknown as CoverageGap,
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: /1 Widerstand offen/ }))
    // Der Handlungssatz kommt aus derselben Vorlage wie der Cowork-Auftrag.
    expect(screen.getByText(/Was tun \(Cowork\)/)).toBeTruthy()
    expect(screen.getByText(/Schreibe einen BERICHT.md/)).toBeTruthy()
    // Und: kein Voll-Scan noetig, um den Befund loszuwerden.
    expect(screen.getByText(/Teilbaum neu scannen/)).toBeTruthy()
  })

  it('markierte Artefakte stehen in der Liste und fuehren per Klick zum Artefakt', () => {
    const markiert = familie('a', {
      transkript: artefakt({ twinStatus: 'flagged', flaggedNote: 'Sprecher vertauscht' }),
    })
    const { onWaehleArtefakt } = renderKopf({
      familien: [markiert],
      k: { ...karte(), gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 }, gapsByType: { twin_flagged: 1 } },
    })
    fireEvent.click(screen.getByRole('button', { name: /1 Widerstand offen/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sprecher vertauscht/ }))
    expect(onWaehleArtefakt).toHaveBeenCalledWith('a')
  })

  it('benennt gekappte Befunde, statt eine zu kurze Liste zu zeigen', () => {
    renderKopf({
      k: { ...karte(), gapsByActor: { mensch: 0, cowork: 9, knowledgescout: 0 }, gapsByType: { report_missing: 9 } },
      befunde: [],
    })
    fireEvent.click(screen.getByRole('button', { name: /9 Widerstaende offen/ }))
    expect(screen.getByText(/9 weitere\(r\) maschinelle\(r\) Befund/)).toBeTruthy()
  })

  it('ohne Widerstand sagt die Liste das ausdruecklich', () => {
    renderKopf({ k: { ...karte(), gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {} } })
    fireEvent.click(screen.getByRole('button', { name: /keine Widerstaende/ }))
    expect(screen.getByText(/Nichts sperrt die Abnahme/)).toBeTruthy()
  })

  it('Report vor Welle 4: Chip benennt den Zustand statt 0/0 zu raten', () => {
    renderKopf({ familien: undefined })
    expect(screen.getByText('Stand: neu scannen')).toBeTruthy()
  })
})

describe('VorhabenKopf — Feedback', () => {
  it('zeigt nach Erfolg den Ueberlagerungs-Hinweis (Report zeigt alten Scan)', () => {
    renderKopf({ stand: fakeStand({ override: { bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: '2026-08-24T23:59:59.999Z' } }) })
    expect(screen.getByText(/Report zeigt noch den alten Scan/)).toBeTruthy()
  })

  it('zeigt die nicht_bereit-Befundliste im Klartext inklusive Kappung', () => {
    renderKopf({
      stand: fakeStand({
        fehler: {
          text: 'Nicht bereit zur Abnahme: 3 maschinelle Befunde offen.',
          code: 'nicht_bereit',
          befunde: [
            { type: 'report_missing', actor: 'cowork', severity: 'error', path: '1. Arbeit/Pilot', message: 'Kein BERICHT.md' },
            { type: 'twin_stale', actor: 'knowledgescout', severity: 'warning', path: '1. Arbeit/Pilot/a.pdf', message: 'Twin veraltet' },
          ],
          gesamt: 3,
        },
      }),
    })
    expect(screen.getByText(/Nicht bereit zur Abnahme/)).toBeTruthy()
    expect(screen.getByText(/Kein BERICHT\.md/)).toBeTruthy()
    expect(screen.getByText(/… und 1 weitere/)).toBeTruthy()
  })
})
