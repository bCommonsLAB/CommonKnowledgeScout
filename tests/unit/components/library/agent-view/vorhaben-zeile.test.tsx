// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Zeilen der Werkbank-Liste (F6, Welle W3).
 *
 * Isoliert getestet, weil der Virtualizer im jsdom keine Zeilen rendert:
 * Ampel-Platzhalter fuer Alt-Karten (kein geratenes Gruen), „bereit"-Badge
 * via geteiltem Praedikat, Auswahl-Klick, Widerspruch-Symbol und der
 * einklappbare Gruppenkopf.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BereichKopfZeile, VorhabenZeile } from '@/components/library/agent-view/werkbank/vorhaben-zeile'
import type { VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function card(overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: 'f-pilot',
    name: 'Pilot',
    path: '1. Arbeit/Pilot',
    bearbeitungsstand: 'erschlossen',
    bearbeitungsstandSeit: null,
    hasBericht: true,
    totalGaps: 1,
    gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
    gapsByType: { twin_unverified: 1 },
    widerspruch: false,
    ampel: 'rot',
    berichtTitel: 'Pilotprojekt Klima',
    berichtFileId: 'id-b1',
    berichtModifiedAt: null,
    berichtStatus: 'aktiv',
    themen: [],
    ...overrides,
  }
}

describe('VorhabenZeile', () => {
  it('zeigt Name, Bericht-Titel, Stand und Befundzaehler; Klick waehlt die folderId', () => {
    const onSelect = vi.fn()
    render(<VorhabenZeile card={card()} ausgewaehlt={false} onSelect={onSelect} />)
    expect(screen.getByText('Pilot')).toBeTruthy()
    expect(screen.getByText('Pilotprojekt Klima')).toBeTruthy()
    expect(screen.getByText('Erschlossen')).toBeTruthy()
    expect(screen.getByText(/M 1 · C 0 · K 0/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('f-pilot')
  })

  it('traegt das „bereit"-Badge nur, wenn das geteilte Praedikat wahr ist', () => {
    render(<VorhabenZeile card={card()} ausgewaehlt={false} onSelect={() => {}} />)
    expect(screen.getByText('bereit')).toBeTruthy()
    cleanup()
    render(
      <VorhabenZeile
        card={card({ gapsByActor: { mensch: 1, cowork: 1, knowledgescout: 0 } })}
        ausgewaehlt={false}
        onSelect={() => {}}
      />,
    )
    expect(screen.queryByText('bereit')).toBeNull()
  })

  it('Alt-Karten ohne ampel zeigen einen benannten Platzhalter statt geratenem Gruen', () => {
    const { ampel: _a, ...alt } = card()
    render(<VorhabenZeile card={alt} ausgewaehlt={false} onSelect={() => {}} />)
    expect(screen.getByLabelText('Ampel unbekannt')).toBeTruthy()
  })

  it('macht den Widerspruch sichtbar', () => {
    render(<VorhabenZeile card={card({ widerspruch: true })} ausgewaehlt={false} onSelect={() => {}} />)
    expect(screen.getByLabelText(/Widerspruch/)).toBeTruthy()
  })
})

describe('BereichKopfZeile', () => {
  it('zeigt Bereich + Anzahl und meldet den Toggle', () => {
    const onToggle = vi.fn()
    render(<BereichKopfZeile bereich="1. Arbeit" anzahl={7} eingeklappt={false} onToggle={onToggle} />)
    expect(screen.getByText('1. Arbeit')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('1. Arbeit')
  })
})
