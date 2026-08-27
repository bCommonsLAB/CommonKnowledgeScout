// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Themen-Editor des Vorhaben-Kopfs (Welle A6).
 *
 * Der Editor normalisiert: das Dropdown bietet das kuratierte Vokabular
 * (ohne bereits zugewiesene), Chips entfernen, neues Thema aufnehmen,
 * Speichern schreibt die KOMPLETTE Liste. Reports vor A6 sperren das
 * Speichern benannt (sonst wuerden Bestands-Themen ueberschrieben).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemenEditor } from '@/components/library/agent-view/werkbank/themen-editor'
import type { UseThemenResult } from '@/hooks/agent-view/use-themen'

afterEach(() => cleanup())

function fakeThemen(overrides: Partial<UseThemenResult> = {}): UseThemenResult {
  return {
    overrides: new Map(),
    pendingFolderId: null,
    fehlerByFolder: new Map(),
    setzeThemen: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function renderEditor(args: {
  aktuelle?: string[] | undefined
  vokabular?: string[]
  themen?: UseThemenResult
} = {}) {
  const themen = args.themen ?? fakeThemen()
  render(
    <ThemenEditor
      folderId="f-klima"
      aktuelle={'aktuelle' in args ? args.aktuelle : ['Klima']}
      vokabular={args.vokabular ?? ['Commoning', 'KI', 'Klima']}
      themen={themen}
    />,
  )
  return { themen }
}

describe('ThemenEditor (A6)', () => {
  it('Dropdown bietet das Vokabular OHNE bereits zugewiesene Themen an', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /Themen \(1\)/ }))
    const optionen = [...screen.getByLabelText('Thema aus dem Vokabular hinzufuegen').querySelectorAll('option')]
      .map((option) => option.textContent)
    expect(optionen).toEqual(['Thema hinzufuegen …', 'Commoning', 'KI'])
  })

  it('Auswahl + neues Thema + Entfernen bauen den Entwurf; Speichern schreibt die Liste', async () => {
    const { themen } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /Themen \(1\)/ }))
    fireEvent.change(screen.getByLabelText('Thema aus dem Vokabular hinzufuegen'), { target: { value: 'KI' } })
    fireEvent.change(screen.getByLabelText('Neues Thema'), { target: { value: 'Energie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aufnehmen' }))
    fireEvent.click(screen.getByLabelText('Thema Klima entfernen'))
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await vi.waitFor(() =>
      expect(themen.setzeThemen).toHaveBeenCalledWith('f-klima', ['KI', 'Energie']),
    )
  })

  it('Report vor A6 (aktuelle undefined): Speichern gesperrt, Grund benannt', () => {
    renderEditor({ aktuelle: undefined })
    fireEvent.click(screen.getByRole('button', { name: /Themen \(\?\)/ }))
    expect(screen.getByText(/erst „Neu scannen"/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Speichern' }).hasAttribute('disabled')).toBe(true)
  })

  it('Routen-Fehler steht als Klartext im Editor', () => {
    renderEditor({
      themen: fakeThemen({ fehlerByFolder: new Map([['f-klima', 'Kein _INDEX.md im Ordner']]) }),
    })
    fireEvent.click(screen.getByRole('button', { name: /Themen \(1\)/ }))
    expect(screen.getByRole('alert').textContent).toContain('Kein _INDEX.md')
  })
})
