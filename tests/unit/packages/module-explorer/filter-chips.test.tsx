// @vitest-environment jsdom

/**
 * `FilterChips` (D12o): gesetzte Filter aus dem geteilten Zustand als Chips
 * mit Beschriftung aus den Facetten und „Zuruecksetzen"; ohne Filter nichts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { galleryFiltersAtom } from '@ks/module-explorer/react'
import { FilterChips, aktiveFilter } from '../../../../packages/module-explorer/src/gallery/components/filter-chips'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'de',
  }),
}))

afterEach(cleanup)

const facetDefs = [
  { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe' },
  { metaKey: 'jahr', label: '' },
]

describe('aktiveFilter', () => {
  it('beschriftet mit dem Facetten-Label, sonst mit dem Schluessel; shortTitle heisst Dokument; leere Werte fallen weg', () => {
    expect(
      aktiveFilter({ arbeitsgruppe: ['Energie', 'Wohnen'], jahr: ['2024'], unbekannt: ['x'], shortTitle: ['Radwege'], leer: [] }, facetDefs, 'Dokument'),
    ).toEqual([
      { key: 'Arbeitsgruppe', value: 'Energie' },
      { key: 'Arbeitsgruppe', value: 'Wohnen' },
      { key: 'jahr', value: '2024' },
      { key: 'unbekannt', value: 'x' },
      { key: 'Dokument', value: 'Radwege' },
    ])
  })
})

describe('FilterChips', () => {
  function montieren(filters: Record<string, string[]>) {
    const store = createStore()
    store.set(galleryFiltersAtom, filters)
    const onClear = vi.fn()
    const { container } = render(
      <Provider store={store}>
        <FilterChips facetDefs={facetDefs} onClear={onClear} />
      </Provider>,
    )
    return { container, onClear }
  }

  it('ohne Filter nichts', () => {
    const { container } = montieren({})
    expect(container.querySelector('[data-filter-chips]')).toBeNull()
  })

  it('zeigt Chips und ruft Zuruecksetzen', () => {
    const { onClear } = montieren({ arbeitsgruppe: ['Energie'] })
    expect(screen.getByText('gallery.filtered:')).toBeTruthy()
    expect(screen.getByText('Arbeitsgruppe: Energie')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'gallery.reset' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
