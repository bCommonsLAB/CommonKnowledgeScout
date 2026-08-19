// @vitest-environment jsdom

/**
 * @fileoverview Component-Tests: Twin-Knoten mit Inline-Kuration (Welle 4, F4).
 *
 * Die Zeile zeigt das fuehrende Artefakt mit Vertrauensampel und bietet GENAU
 * zwei Aktionen: twin_status-Dropdown und Verify — beide delegieren an den
 * Aufrufer (der die Kurations-Patch-Route spricht, Contract §4).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TwinFamilyRow } from '@/components/library/agent-view/twin-family-row'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function leading(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transformation',
    templateName: 'standard-konzept',
    targetLanguage: 'de',
    twinStatus: 'draft',
    generatedBy: 'knowledgescout/gemini-2.5-pro',
    generatedAt: '2026-08-01T10:00:00.000Z',
    verifiedBy: null,
    verifiedAt: null,
    verification: 'unverifiziert',
    ...overrides,
  }
}

function family(overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return {
    sourceId: 's1',
    sourceName: 'Aufnahme.m4a',
    folderId: 'f1',
    path: '25.01 Pilot/Aufnahme.m4a',
    artifactCount: 2,
    leading: leading(),
    ...overrides,
  }
}

function renderRow(overrides: Partial<TwinFamilySummary> = {}, props: Partial<Parameters<typeof TwinFamilyRow>[0]> = {}) {
  const onSetStatus = vi.fn()
  const onVerify = vi.fn()
  render(
    <TwinFamilyRow
      family={family(overrides)}
      pending={false}
      error={null}
      onSetStatus={onSetStatus}
      onVerify={onVerify}
      {...props}
    />,
  )
  return { onSetStatus, onVerify }
}

describe('TwinFamilyRow', () => {
  it('zeigt Quelle, fuehrendes Artefakt und Vertrauensampel', () => {
    renderRow()
    expect(screen.getByText('Aufnahme.m4a')).toBeTruthy()
    expect(screen.getByText('standard-konzept.de')).toBeTruthy()
    expect(screen.getByLabelText('Unverifiziert')).toBeTruthy()
  })

  it('Verify-Aktion delegiert an den Aufrufer (Kurations-Patch-Route)', () => {
    const { onVerify } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Verifizieren/ }))
    expect(onVerify).toHaveBeenCalledTimes(1)
  })

  it('twin_status-Dropdown liefert den gewaehlten Wert', () => {
    const { onSetStatus } = renderRow()
    fireEvent.change(screen.getByLabelText(/twin_status von Aufnahme.m4a/), { target: { value: 'stable' } })
    expect(onSetStatus).toHaveBeenCalledWith('stable')
  })

  it('zeigt gueltige Mensch-Verifikation mit Actor an', () => {
    renderRow({
      leading: leading({
        verifiedBy: 'human:peter', verifiedAt: '2026-08-19', verification: 'mensch',
      }),
    })
    expect(screen.getByText('human:peter')).toBeTruthy()
    expect(screen.getByLabelText('Von Mensch geprueft')).toBeTruthy()
  })

  it('zeigt 409-Befunde als Klartext an der Zeile (nichts ueberschrieben)', () => {
    renderRow({}, { error: 'Spiegel-Datei „X.md" weicht vom MongoDB-Stand ab — erst importieren' })
    expect(screen.getByRole('alert').textContent).toContain('erst importieren')
  })

  it('unbekannter Bestands-Status bleibt sichtbar statt still umgedeutet', () => {
    renderRow({ leading: leading({ twinStatus: 'final' }) })
    const select = screen.getByLabelText(/twin_status von/) as HTMLSelectElement
    expect(select.value).toBe('final')
    expect(screen.getByText('Unbekannt: final')).toBeTruthy()
  })

  it('Familie ohne fuehrendes Artefakt: Hinweis statt Aktionen', () => {
    renderRow({ leading: null })
    expect(screen.getByText(/ohne fuehrendes Artefakt/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
