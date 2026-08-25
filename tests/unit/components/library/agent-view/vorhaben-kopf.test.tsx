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
import type { LeadingArtifactSummary, TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'

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
    gapsByType: { twin_unverified: 1 }, widerspruch: false,
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
    setzeTwinStatus: vi.fn().mockResolvedValue(undefined),
    sammelVerifiziere: vi.fn().mockResolvedValue({ erledigt: 0, gesamt: 0, fehler: [] }),
    sammelLaeuft: false,
    ...overrides,
  }
}

function renderKopf(args: {
  k?: VorhabenCard
  stand?: UseStandResult
  familien?: TwinFamilySummary[] | undefined
  kuration?: UseArtefaktKurationResult
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
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
        befunde={[]}
        auftragContext={{ libraryLabel: 'Testarchiv', localRootPath: null, generatedAt: 'G1' }}
      />
    </QueryClientProvider>,
  )
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

describe('VorhabenKopf — Zeile 2: Fortschritt + Sammelaktion', () => {
  it('zeigt n von m geprueft aus den effektiven Familien', () => {
    renderKopf({
      familien: [
        familie('a', { transkript: artefakt({ verification: 'mensch' }) }),
        familie('b'),
      ],
    })
    expect(screen.getByText('1 von 2 geprueft')).toBeTruthy()
  })

  it('Sammelaktion fragt mit der Zahl zurueck und verifiziert erst nach Bestaetigung', async () => {
    const kuration = fakeKuration({
      sammelVerifiziere: vi.fn().mockResolvedValue({ erledigt: 2, gesamt: 2, fehler: [] }),
    })
    renderKopf({ familien: [familie('a'), familie('b')], kuration })
    fireEvent.click(screen.getByRole('button', { name: /2 Transkripte pruefen/ }))
    expect(screen.getByText('2 Transkripte als geprueft bestaetigen?')).toBeTruthy()
    expect(kuration.sammelVerifiziere).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Ja, 2 verifizieren/ }))
    await vi.waitFor(() => expect(kuration.sammelVerifiziere).toHaveBeenCalledTimes(1))
    const ziele = (kuration.sammelVerifiziere as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(ziele).toHaveLength(2)
    expect(await screen.findByText(/2 von 2 verifiziert/)).toBeTruthy()
  })

  it('Report vor Welle 4: Chip benennt den Zustand statt 0/0 zu raten', () => {
    renderKopf({ familien: undefined })
    expect(screen.getByText('Pruefstand: neu scannen')).toBeTruthy()
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
