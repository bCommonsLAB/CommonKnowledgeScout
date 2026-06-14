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
    const lockedRemove = screen.getByTitle('Basis-Facette: nicht entfernbar') as HTMLButtonElement
    expect(lockedRemove.disabled).toBe(true)
  })

  it('laesst eine Nicht-Basis-Facette (region) editierbar', () => {
    render(<FacetDefsEditor value={value} onChange={() => {}} />)
    const regionInput = screen.getByDisplayValue('region') as HTMLInputElement
    expect(regionInput.disabled).toBe(false)
    const removeBtn = screen.getByTitle('Entfernen') as HTMLButtonElement
    expect(removeBtn.disabled).toBe(false)
  })
})
