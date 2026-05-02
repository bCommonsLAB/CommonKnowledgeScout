// @vitest-environment jsdom

/**
 * Characterization Tests fuer `FileCategoryFilter` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-a (Filter-Komponenten gehoeren zur
 * Galerie-Welt). Fixiert:
 * - Render-Smoke mit allen 4 Kategorie-Optionen (all/media/text/documents)
 * - Aktiver Filter wird visuell markiert
 * - Klick auf Option ruft Atom-Setter auf (= aendert activeFilter)
 * - iconOnly-Variante rendert nur Icons, keine Labels
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { Provider, useAtomValue } from 'jotai'
import { FileCategoryFilter } from '@/components/library/file-category-filter'
import { fileCategoryFilterAtom } from '@/atoms/transcription-options'

function CurrentValue() {
  const value = useAtomValue(fileCategoryFilterAtom)
  return <span data-testid="current-value">{value}</span>
}

describe('FileCategoryFilter', () => {
  beforeEach(() => {
    // Jotai-Provider isoliert die Atoms pro Test
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert alle vier Kategorien (Alle, Medien, Text, Dokumente)', () => {
    render(
      <Provider>
        <FileCategoryFilter />
      </Provider>,
    )
    expect(screen.getByText('Alle')).toBeTruthy()
    expect(screen.getByText('Medien')).toBeTruthy()
    expect(screen.getByText('Text')).toBeTruthy()
    expect(screen.getByText('Dokumente')).toBeTruthy()
  })

  it('aktualisiert das Atom, wenn eine Kategorie geklickt wird', () => {
    render(
      <Provider>
        <FileCategoryFilter />
        <CurrentValue />
      </Provider>,
    )

    // Default-Wert
    expect(screen.getByTestId('current-value').textContent).toBe('all')

    // Klick auf "Medien"
    fireEvent.click(screen.getByText('Medien'))
    expect(screen.getByTestId('current-value').textContent).toBe('media')

    // Klick auf "Dokumente"
    fireEvent.click(screen.getByText('Dokumente'))
    expect(screen.getByTestId('current-value').textContent).toBe('documents')
  })

  it('rendert in iconOnly-Mode keine Label-Texte', () => {
    render(
      <Provider>
        <FileCategoryFilter iconOnly />
      </Provider>,
    )
    expect(screen.queryByText('Alle')).toBeNull()
    expect(screen.queryByText('Medien')).toBeNull()
    expect(screen.queryByText('Text')).toBeNull()
    expect(screen.queryByText('Dokumente')).toBeNull()

    // Aber: 4 Buttons sind trotzdem da
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
  })

  it('zeigt Description als title-Attribut auf jedem Button', () => {
    render(
      <Provider>
        <FileCategoryFilter />
      </Provider>,
    )
    const allButton = screen.getByText('Alle').closest('button')!
    expect(allButton.getAttribute('title')).toBe('Alle Dateien anzeigen')
  })
})
