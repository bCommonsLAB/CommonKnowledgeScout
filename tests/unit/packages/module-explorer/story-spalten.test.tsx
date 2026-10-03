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
import { useBelegSprung } from '../../../../packages/module-explorer/src/gallery/components/beleg-sprung'
import { STORY_BELEG_ZEIGEN_EVENT } from '@ks/contracts'

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

  it('oeffnen (D12e) oeffnet und merkt „auf"; nochmal oeffnen aendert nichts', () => {
    const { result } = renderHook(() => useQuellenOffen())
    act(() => result.current.oeffnen())
    expect(result.current.offen).toBe(true)
    expect(localStorage.getItem(QUELLEN_OFFEN_KEY)).toBe('true')
    act(() => result.current.oeffnen())
    expect(result.current.offen).toBe(true)
  })
})

describe('useBelegSprung (D12e)', () => {
  it('oeffnet die Quellen auf das Ereignis der Mitte und scrollt zur Karte, sobald sie da ist', () => {
    const { result } = renderHook(() => {
      const leiste = useQuellenOffen()
      useBelegSprung(leiste)
      return leiste
    })
    expect(result.current.offen).toBe(false)
    act(() => {
      window.dispatchEvent(new CustomEvent(STORY_BELEG_ZEIGEN_EVENT, { detail: { marke: '2' } }))
    })
    expect(result.current.offen).toBe(true)
    // Die Karte erscheint erst mit der offenen Schicht — der Sprung wartet darauf.
    const karte = document.createElement('li')
    karte.id = 'beleg-2'
    karte.scrollIntoView = vi.fn()
    document.body.appendChild(karte)
    act(() => {
      window.dispatchEvent(new CustomEvent(STORY_BELEG_ZEIGEN_EVENT, { detail: { marke: '2' } }))
    })
    expect(karte.scrollIntoView).toHaveBeenCalledTimes(1)
    karte.remove()
  })

  it('D12i: nimmt ein beliebiges Ziel — auf Mobil das Blatt mit den Belegen', () => {
    const oeffnen = vi.fn()
    const { rerender } = renderHook(({ offen }: { offen: boolean }) => useBelegSprung({ offen, oeffnen }), { initialProps: { offen: false } })
    act(() => {
      window.dispatchEvent(new CustomEvent(STORY_BELEG_ZEIGEN_EVENT, { detail: { marke: '3' } }))
    })
    expect(oeffnen).toHaveBeenCalledTimes(1)
    const karte = document.createElement('li')
    karte.id = 'beleg-3'
    karte.scrollIntoView = vi.fn()
    document.body.appendChild(karte)
    rerender({ offen: true })
    expect(karte.scrollIntoView).toHaveBeenCalledTimes(1)
    karte.remove()
  })

  it('ohne Karte wird gewarnt, nicht geschwiegen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderHook(() => {
      const leiste = useQuellenOffen()
      useBelegSprung(leiste)
    })
    act(() => {
      window.dispatchEvent(new CustomEvent(STORY_BELEG_ZEIGEN_EVENT, { detail: { marke: '9' } }))
    })
    expect(warn).toHaveBeenCalledWith('[useBelegSprung] Keine Belegkarte zur Marke gefunden', { marke: '9' })
    warn.mockRestore()
  })
})
