// @vitest-environment jsdom

/**
 * Characterization Tests fuer `ViewModeToggle` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-a. Fixiert:
 * - Render-Smoke mit beiden Modi (grid/table)
 * - onViewModeChange wird mit dem korrekten Modus aufgerufen
 * - aria-labels sind gesetzt (Accessibility)
 * - compact-Variante bewirkt sichtbar andere Sizes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ViewModeToggle } from '@/components/library/gallery/view-mode-toggle'

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ViewModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert beide Buttons (grid + table) mit aria-labels', () => {
    render(<ViewModeToggle viewMode="grid" onViewModeChange={vi.fn()} />)
    expect(screen.getByLabelText('gallery.viewMode.grid')).toBeTruthy()
    expect(screen.getByLabelText('gallery.viewMode.table')).toBeTruthy()
  })

  it('ruft onViewModeChange mit "grid" auf, wenn Grid-Button geklickt wird', () => {
    const onChange = vi.fn()
    render(<ViewModeToggle viewMode="table" onViewModeChange={onChange} />)
    fireEvent.click(screen.getByLabelText('gallery.viewMode.grid'))
    expect(onChange).toHaveBeenCalledWith('grid')
  })

  it('ruft onViewModeChange mit "table" auf, wenn Table-Button geklickt wird', () => {
    const onChange = vi.fn()
    render(<ViewModeToggle viewMode="grid" onViewModeChange={onChange} />)
    fireEvent.click(screen.getByLabelText('gallery.viewMode.table'))
    expect(onChange).toHaveBeenCalledWith('table')
  })

  it('zeigt den Graph-Button NUR, wenn showGraph=true (Default: aus)', () => {
    const { rerender } = render(<ViewModeToggle viewMode="grid" onViewModeChange={vi.fn()} />)
    expect(screen.queryByLabelText('gallery.viewMode.graph')).toBeNull()
    rerender(<ViewModeToggle viewMode="grid" onViewModeChange={vi.fn()} showGraph />)
    expect(screen.getByLabelText('gallery.viewMode.graph')).toBeTruthy()
  })

  it('ruft onViewModeChange mit "graph" auf, wenn Graph-Button geklickt wird', () => {
    const onChange = vi.fn()
    render(<ViewModeToggle viewMode="grid" onViewModeChange={onChange} showGraph />)
    fireEvent.click(screen.getByLabelText('gallery.viewMode.graph'))
    expect(onChange).toHaveBeenCalledWith('graph')
  })

  it('rendert in compact-Variante ohne Label-Text', () => {
    render(<ViewModeToggle viewMode="grid" onViewModeChange={vi.fn()} compact />)
    // Im compact-Mode ist `!compact && <span>...</span>` false → kein Label-Text
    // (Der aria-label bleibt aber gesetzt — siehe Accessibility-Test oben)
    const buttons = screen.getAllByRole('button')
    // Buttons existieren, aber haben keine Label-Text-Children
    expect(buttons.length).toBe(2)
    for (const btn of buttons) {
      // Keine sichtbaren Text-Spans in compact mode
      expect(btn.querySelectorAll('span').length).toBe(0)
    }
  })
})
