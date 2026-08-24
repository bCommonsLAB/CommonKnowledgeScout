// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Stand-Aktionen im Detail-Kopf (F8, Welle W7).
 *
 * Geprueft wird der eine CTA: „Abnehmen" nur beim geteilten Praedikat aktiv
 * (deaktiviert nennt der Tooltip die Blocker bzw. „bereits abgenommen"),
 * das Stand-Menue ohne `abgenommen`-Option (Abnahme geht nur ueber den
 * Button mit Precheck), „Stand bestaetigen" mit `bestaetigen: true`, der
 * Ueberlagerungs-Hinweis nach Erfolg und die `nicht_bereit`-Befundliste.
 * Der Hook ist als schmales Fake-Objekt gestubbt — kein Fetch im Test.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StandAktionen } from '@/components/library/agent-view/werkbank/stand-aktionen'
import type { StandFehler, StandOverride, UseStandResult } from '@/hooks/agent-view/use-stand'
import type { VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

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

function renderAktionen(k: VorhabenCard, stand: UseStandResult) {
  return render(<StandAktionen karte={k} generatedAt="G1" stand={stand} />)
}

describe('StandAktionen — Abnehmen-Button', () => {
  it('ist beim geteilten Praedikat aktiv und beurkundet mit erwartetem Stand + Report-Stand', () => {
    const setzeStand = vi.fn().mockResolvedValue(undefined)
    renderAktionen(karte(), fakeStand({ setzeStand }))
    const knopf = screen.getByRole('button', { name: 'Abnehmen' })
    expect(knopf.hasAttribute('disabled')).toBe(false)
    fireEvent.click(knopf)
    expect(setzeStand).toHaveBeenCalledWith({
      folderId: 'f-pilot', stand: 'abgenommen', erwarteterStand: 'berichtet',
      reportGeneratedAt: 'G1', bestaetigen: false,
    })
  })

  it('ist bei Maschinen-Befunden deaktiviert — der Tooltip nennt die Blocker', () => {
    renderAktionen(karte({ gapsByActor: { mensch: 0, cowork: 1, knowledgescout: 2 } }), fakeStand())
    expect(screen.getByRole('button', { name: 'Abnehmen' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTitle(/1 Cowork-Befund und 2 KnowledgeScout-Befunde offen/)).toBeTruthy()
  })

  it('ist nach der Abnahme deaktiviert und verweist auf „Stand bestaetigen"', () => {
    renderAktionen(
      karte(),
      fakeStand({ override: { bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: null } }),
    )
    expect(screen.getByRole('button', { name: 'Abnehmen' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTitle(/Bereits abgenommen/)).toBeTruthy()
  })
})

describe('StandAktionen — Stand-Menue', () => {
  it('bietet bestaetigen + alle Staende ausser abgenommen und dem aktuellen an', () => {
    renderAktionen(karte(), fakeStand())
    const optionen = [...screen.getByLabelText('Stand-Menue').querySelectorAll('option')].map(
      (option) => option.getAttribute('value'),
    )
    expect(optionen).toEqual(['', 'bestaetigen', 'ungesichtet', 'erschlossen', 'strukturiert'])
  })

  it('bestaetigen sendet den GLEICHEN Stand mit bestaetigen: true', () => {
    const setzeStand = vi.fn().mockResolvedValue(undefined)
    renderAktionen(karte(), fakeStand({ setzeStand }))
    fireEvent.change(screen.getByLabelText('Stand-Menue'), { target: { value: 'bestaetigen' } })
    expect(setzeStand).toHaveBeenCalledWith(
      expect.objectContaining({ stand: 'berichtet', erwarteterStand: 'berichtet', bestaetigen: true }),
    )
  })

  it('Zurueckstufen sendet den Zielstand ohne bestaetigen', () => {
    const setzeStand = vi.fn().mockResolvedValue(undefined)
    renderAktionen(karte(), fakeStand({ setzeStand }))
    fireEvent.change(screen.getByLabelText('Stand-Menue'), { target: { value: 'erschlossen' } })
    expect(setzeStand).toHaveBeenCalledWith(
      expect.objectContaining({ stand: 'erschlossen', bestaetigen: false }),
    )
  })
})

describe('StandAktionen — Feedback', () => {
  it('zeigt nach Erfolg den Ueberlagerungs-Hinweis (Report zeigt alten Scan)', () => {
    renderAktionen(
      karte(),
      fakeStand({ override: { bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: '2026-08-24T23:59:59.999Z' } }),
    )
    expect(screen.getByText(/Report zeigt noch den alten Scan/)).toBeTruthy()
  })

  it('zeigt die nicht_bereit-Befundliste im Klartext inklusive Kappung', () => {
    renderAktionen(
      karte(),
      fakeStand({
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
    )
    expect(screen.getByText(/Nicht bereit zur Abnahme/)).toBeTruthy()
    expect(screen.getByText(/Kein BERICHT\.md/)).toBeTruthy()
    expect(screen.getByText(/… und 1 weitere/)).toBeTruthy()
  })
})
