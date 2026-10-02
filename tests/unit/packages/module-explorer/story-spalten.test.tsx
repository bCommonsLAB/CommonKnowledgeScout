// @vitest-environment jsdom

/**
 * `StorySpalten` mit Quellen-Leiste (D11b, Figma „Schritt 8"): eingeklappt
 * eine schmale Leiste mit Zaehler statt der Spalte, aufgeklappt die Spalte
 * mit Pfeil zum Einklappen; ohne `leiste` (Embed) immer die Spalte.
 * `useQuellenOffen`: beim Einstieg zu, der Browser merkt sich „auf".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { StorySpalten } from '../../../../packages/module-explorer/src/gallery/components/story-spalten'
import { QUELLEN_OFFEN_KEY, useQuellenOffen } from '../../../../packages/module-explorer/src/gallery/components/quellen-leiste'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('StorySpalten (D11b Quellen-Leiste)', () => {
  it('zu: Leiste mit Zaehler „610 Quellen" statt Spalte; Pfeil klappt auf', () => {
    const onToggle = vi.fn()
    render(<StorySpalten chronik={<div>Chronik</div>} mitte={<div>Mitte</div>} quellen={<div>Quellenliste</div>} leiste={{ offen: false, onToggle, zaehler: 610, belege: false }} />)
    expect(screen.queryByText('Quellenliste')).toBeNull()
    const leiste = screen.getByLabelText('610 gallery.sources')
    expect(leiste.textContent).toContain('610')
    fireEvent.click(screen.getByRole('button', { name: 'story.leiste.oeffnen' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('zu nach einer Antwort: blauer Zaehler der Belege', () => {
    render(<StorySpalten mitte={<div>Mitte</div>} quellen={<div>Belege</div>} leiste={{ offen: false, onToggle: () => {}, zaehler: 4, belege: true }} />)
    expect(screen.getByLabelText('4 story.beleg.title').querySelector('[data-belege-zaehler]')?.textContent).toBe('4')
  })

  it('auf: Quellen als Schicht ueber der Mitte (Mitte bleibt), Pfeil klappt ein; ohne leiste feste Spalte', () => {
    const onToggle = vi.fn()
    const { unmount } = render(<StorySpalten mitte={<div>Mitte</div>} quellen={<div>Quellenliste</div>} leiste={{ offen: true, onToggle, zaehler: 610, belege: false }} />)
    expect(screen.getByText('Quellenliste')).toBeTruthy()
    expect(screen.getByText('Mitte')).toBeTruthy()
    expect(document.querySelector('[data-story-quellen][data-fliegend]')).not.toBeNull()
    // Die Leiste bleibt unsichtbar stehen, damit die Spaltenbreiten gleich bleiben
    expect(document.querySelector('[data-story-quellen-leiste]')?.getAttribute('data-story-quellen-leiste')).toBe('unsichtbar')
    fireEvent.click(screen.getByRole('button', { name: 'story.leiste.schliessen' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    unmount()
    render(<StorySpalten mitte={<div>Mitte</div>} quellen={<div>Quellenliste</div>} />)
    expect(screen.getByText('Quellenliste')).toBeTruthy()
    expect(document.querySelector('[data-story-quellen][data-fliegend]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'story.leiste.schliessen' })).toBeNull()
  })
})

describe('useQuellenOffen', () => {
  it('beim Einstieg zu; toggle merkt „auf" im Browser und wieder zu', () => {
    const { result } = renderHook(() => useQuellenOffen())
    expect(result.current.offen).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.offen).toBe(true)
    expect(localStorage.getItem(QUELLEN_OFFEN_KEY)).toBe('true')
    act(() => result.current.toggle())
    expect(result.current.offen).toBe(false)
    expect(localStorage.getItem(QUELLEN_OFFEN_KEY)).toBeNull()
  })

  it('gemerktes „auf" gilt beim naechsten Besuch', () => {
    localStorage.setItem(QUELLEN_OFFEN_KEY, 'true')
    const { result } = renderHook(() => useQuellenOffen())
    expect(result.current.offen).toBe(true)
  })
})
