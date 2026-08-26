// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Abnahme-Kopf des Artefakts (Welle A4, Zustand B).
 *
 * Der Kopf verifiziert ODER markiert das Artefakt des AKTIVEN Tabs; auf dem
 * Original-Tab sind beide Aktionen benannt gesperrt. Nach Erfolg meldet
 * `onKuriert` Art + frischen Zustand (Sprung); der Sprung-Hinweis steht in
 * Zeile 2, 409-Befunde als Klartext darunter. Zeichensprache nach ADR 0006:
 * angenommen / geprueft / stimmt nicht.
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
    flaggedBy: null, flaggedAt: null, flaggedNote: null,
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
    markiere: vi.fn().mockResolvedValue(null),
    setzeTwinStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderKopf(args: {
  f?: TwinFamilySummary
  tab?: ArtefaktTab
  kuration?: UseArtefaktKurationResult
  onKuriert?: ReturnType<typeof vi.fn>
} = {}) {
  const onKuriert = args.onKuriert ?? vi.fn()
  render(
    <ArtefaktKopf
      familie={args.f ?? familie()}
      tab={args.tab ?? 'transkript'}
      kuration={args.kuration ?? fakeKuration()}
      libraryId="lib-1"
      onKuriert={onKuriert}
    />,
  )
  return { onKuriert }
}

describe('ArtefaktKopf (A4)', () => {
  it('verifiziert das Artefakt des aktiven Tabs und meldet den frischen Zustand', async () => {
    const frisch = artefakt({ verification: 'mensch', verifiedBy: 'human:peter' })
    const kuration = fakeKuration({ verifiziere: vi.fn().mockResolvedValue(frisch) })
    const { onKuriert } = renderKopf({ kuration })
    fireEvent.click(screen.getByRole('button', { name: 'Verifizieren' }))
    await vi.waitFor(() => expect(onKuriert).toHaveBeenCalledWith('transkript', frisch))
    const aufruf = (kuration.verifiziere as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(aufruf[1].kind).toBe('transcript')
  })

  it('unangetastete Maschinenarbeit traegt den Chip „angenommen", nicht „Unverifiziert"', () => {
    renderKopf()
    expect(screen.getByText('angenommen')).toBeTruthy()
    expect(screen.queryByText('Unverifiziert')).toBeNull()
  })

  it('markieren verlangt eine Notiz und meldet danach den frischen Zustand', async () => {
    const frisch = artefakt({ twinStatus: 'flagged', flaggedNote: 'Sprecher vertauscht', flaggedBy: 'human:peter' })
    const kuration = fakeKuration({ markiere: vi.fn().mockResolvedValue(frisch) })
    const { onKuriert } = renderKopf({ kuration })
    fireEvent.click(screen.getByRole('button', { name: 'stimmt nicht' }))
    // Ohne Notiz bleibt der Knopf gesperrt — kein stilles Absenden.
    expect(screen.getByRole('button', { name: 'Markieren' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Was stimmt nicht?'), { target: { value: 'Sprecher vertauscht' } })
    fireEvent.click(screen.getByRole('button', { name: 'Markieren' }))
    await vi.waitFor(() => expect(onKuriert).toHaveBeenCalledWith('transkript', frisch))
    expect(kuration.markiere).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 's-egger' }),
      expect.objectContaining({ kind: 'transcript' }),
      'Sprecher vertauscht',
    )
  })

  it('markiertes Artefakt: Chip „stimmt nicht", Notiz und Urheber sichtbar, kein Markier-Knopf', () => {
    renderKopf({
      f: familie({
        transkript: artefakt({ twinStatus: 'flagged', flaggedNote: 'Zahlen falsch', flaggedBy: 'human:peter', flaggedAt: '2026-08-26T09:00:00.000Z' }),
      }),
    })
    expect(screen.getByText('stimmt nicht')).toBeTruthy()
    expect(screen.getByText(/Zahlen falsch/)).toBeTruthy()
    expect(screen.getByText(/human:peter, 2026-08-26/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'stimmt nicht' })).toBeNull()
    // Verifizieren bleibt moeglich — es loest die Markierung auf.
    expect(screen.getByRole('button', { name: 'Verifizieren' }).hasAttribute('disabled')).toBe(false)
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

  it('Zeile 2 traegt Breadcrumb und den Sprung-Hinweis', () => {
    renderKopf()
    expect(screen.getByText('Sprung: naechster Widerstand')).toBeTruthy()
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
