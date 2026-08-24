// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Abnahme-Kopf des Artefakts (Welle A4, Zustand B).
 *
 * Der Kopf verifiziert das Artefakt des AKTIVEN Tabs; auf dem Original-Tab
 * ist der Knopf benannt gesperrt (Entscheidung 4). Nach Erfolg meldet
 * `onVerifiziert` Art + frischen Zustand (Sprung, Entscheidung 5); der
 * Sprung-Hinweis steht in Zeile 2, 409-Befunde als Klartext darunter.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ArtefaktKopf } from '@/components/library/agent-view/werkbank/artefakt-kopf'
import type { UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'
import { artefaktKey } from '@/lib/agent-view/werkbank-baum'
import type { ArtefaktTab } from '@/components/library/agent-view/werkbank/werkbank-artefakt-dokument'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    verification: 'unverifiziert', ...overrides,
  }
}

function familie(overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return {
    sourceId: 's-egger', sourceName: 'Treffen Thomas Egger.m4a', folderId: 'f-klimaclub',
    path: '26.01 Klima/Klimaclub/Treffen Thomas Egger.m4a', artifactCount: 2, leading: artefakt(),
    transkript: artefakt(),
    zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard' }),
    ...overrides,
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
  f?: TwinFamilySummary
  tab?: ArtefaktTab
  kuration?: UseArtefaktKurationResult
  onVerifiziert?: ReturnType<typeof vi.fn>
} = {}) {
  const onVerifiziert = args.onVerifiziert ?? vi.fn()
  render(
    <ArtefaktKopf
      familie={args.f ?? familie()}
      tab={args.tab ?? 'transkript'}
      kuration={args.kuration ?? fakeKuration()}
      libraryId="lib-1"
      onVerifiziert={onVerifiziert}
    />,
  )
  return { onVerifiziert }
}

describe('ArtefaktKopf (A4)', () => {
  it('verifiziert das Artefakt des aktiven Tabs und meldet den frischen Zustand', async () => {
    const frisch = artefakt({ verification: 'mensch', verifiedBy: 'human:peter' })
    const kuration = fakeKuration({ verifiziere: vi.fn().mockResolvedValue(frisch) })
    const { onVerifiziert } = renderKopf({ kuration })
    fireEvent.click(screen.getByRole('button', { name: 'Verifizieren' }))
    await vi.waitFor(() => expect(onVerifiziert).toHaveBeenCalledWith('transkript', frisch))
    const aufruf = (kuration.verifiziere as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(aufruf[1].kind).toBe('transcript')
  })

  it('auf dem Original-Tab ist der Knopf benannt gesperrt — das Original traegt kein Haekchen', () => {
    renderKopf({ tab: 'original' })
    expect(screen.getByRole('button', { name: 'Verifizieren' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTitle(/Das Original traegt kein Haekchen/)).toBeTruthy()
    expect(screen.getByText('Referenz')).toBeTruthy()
  })

  it('geprueftes Artefakt: Chip „geprueft", Knopf gesperrt mit verified_by im Titel', () => {
    renderKopf({
      f: familie({ transkript: artefakt({ verification: 'mensch', verifiedBy: 'human:peter' }) }),
    })
    expect(screen.getByText('geprueft')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Verifizieren' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTitle(/Bereits geprueft von human:peter/)).toBeTruthy()
  })

  it('Zeile 2 traegt Breadcrumb und den Sprung-Hinweis (Entscheidung 5)', () => {
    renderKopf()
    expect(screen.getByText('nach dem Bestaetigen: naechstes offenes')).toBeTruthy()
    expect(screen.getByTitle(/26.01 Klima\/Klimaclub/)).toBeTruthy()
  })

  it('409-Befund der Kurations-Route steht als Klartext unter dem Kopf', () => {
    const f = familie()
    const key = artefaktKey(f.sourceId, f.transkript as LeadingArtifactSummary)
    renderKopf({ f, kuration: fakeKuration({ fehler: new Map([[key, 'Spiegel-Drift: erst importieren']]) }) })
    expect(screen.getByRole('alert').textContent).toContain('Spiegel-Drift')
  })

  it('Menue ⋯ traegt twin_status-Auswahl und sourceId kopieren', () => {
    const kuration = fakeKuration()
    renderKopf({ kuration })
    fireEvent.click(screen.getByRole('button', { name: /Menue zu Treffen/ }))
    fireEvent.change(screen.getByLabelText(/twin_status von/), { target: { value: 'stable' } })
    expect(kuration.setzeTwinStatus).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 's-egger' }),
      expect.objectContaining({ kind: 'transcript' }),
      'stable',
    )
    expect(screen.getByRole('button', { name: /sourceId kopieren/ })).toBeTruthy()
  })
})
