// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FacetDefsEditor, type FacetDefUi } from '@/components/settings/FacetDefsEditor'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

afterEach(() => cleanup())

const value: FacetDefUi[] = [
  { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true, showInTable: false },
  { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true, showInTable: false },
]

describe('FacetDefsEditor — Basis-Facetten-Sperre (A2)', () => {
  it('sperrt eine Basis-Facette (tags): metaKey-Eingabe und Entfernen deaktiviert', () => {
    render(<FacetDefsEditor value={value} onChange={() => {}} />)
    const tagsInput = screen.getByDisplayValue('tags') as HTMLInputElement
    expect(tagsInput.disabled).toBe(true)
    // Es erscheinen mehrere Basis-Facetten (date/authors/source vorangestellt +
    // tags) — ALLE muessen als nicht entfernbar gesperrt sein.
    const lockedRemoves = screen.getAllByTitle('Basis-Facette: nicht entfernbar') as HTMLButtonElement[]
    expect(lockedRemoves.length).toBeGreaterThanOrEqual(2)
    for (const btn of lockedRemoves) expect(btn.disabled).toBe(true)
  })

  it('laesst eine Nicht-Basis-Facette (region) editierbar', () => {
    render(<FacetDefsEditor value={value} onChange={() => {}} />)
    const regionInput = screen.getByDisplayValue('region') as HTMLInputElement
    expect(regionInput.disabled).toBe(false)
    const removeBtn = screen.getByTitle('Entfernen') as HTMLButtonElement
    expect(removeBtn.disabled).toBe(false)
  })

  it('stellt fehlende Basis-Facetten voran, damit ihre Sichtbarkeit schaltbar ist', () => {
    // value enthaelt NUR tags (Basis) + region — authors/source/date fehlen.
    render(<FacetDefsEditor value={value} onChange={() => {}} />)
    // authors + source werden ergaenzt und sind sichtbar (als Zeile vorhanden).
    expect(screen.getByDisplayValue('authors')).toBeTruthy()
    expect(screen.getByDisplayValue('source')).toBeTruthy()
  })
})
