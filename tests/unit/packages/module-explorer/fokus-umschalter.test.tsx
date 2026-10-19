// @vitest-environment jsdom

/**
 * G2: Umschalter „Im Fokus · N | Alle · M" — beide Segmente sind Adressen,
 * die Zahlen kommen aus dem Zahlen-Hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { FokusUmschalter } from '@ks/module-explorer/gallery/components/fokus-umschalter'

const pushMock = vi.fn()
let currentSearch = ''
let mockZahlen: { fokus: number | null; alle: number | null; fehler: string | null } = { fokus: 36, alle: 607, fehler: null }

vi.mock('@ks/module-explorer/gallery/contexts/gallery-navigation-context', () => ({
  useGalleryNavigation: () => ({
    params: new URLSearchParams(currentSearch),
    pushParams: (next: URLSearchParams) => pushMock(next.toString()),
  }),
}))
vi.mock('@ks/module-explorer/gallery/hooks/use-fokus-zahlen', () => ({
  useFokusZahlen: () => mockZahlen,
}))
vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
    locale: 'de',
  }),
}))

describe('FokusUmschalter', () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearch = ''
    mockZahlen = { fokus: 36, alle: 607, fehler: null }
  })
  afterEach(() => cleanup())

  it('zeigt beide Zahlen; ohne starred ist „Alle" aktiv; Klick auf Im Fokus setzt beide Parameter', () => {
    render(<FokusUmschalter libraryId="lib-1" />)
    expect(screen.getByText('36')).toBeTruthy()
    expect(screen.getByText('607')).toBeTruthy()
    expect(screen.getByTitle('Alle').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Im Fokus').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByTitle('Im Fokus'))
    expect(String(pushMock.mock.calls[0][0])).toBe('starred=1&sort=stars')
  })

  it('mit starred=1 ist Im Fokus aktiv; Klick auf Alle nimmt starred und sort=stars weg', () => {
    currentSearch = 'view=gallery&starred=1&sort=stars'
    render(<FokusUmschalter libraryId="lib-1" />)
    expect(screen.getByTitle('Im Fokus').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTitle('Alle'))
    expect(String(pushMock.mock.calls[0][0])).toBe('view=gallery')
  })

  it('Klick auf das aktive Segment schreibt nichts; ohne Zahlen keine Zaehler', () => {
    mockZahlen = { fokus: null, alle: null, fehler: 'HTTP 500' }
    render(<FokusUmschalter libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Alle'))
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByText('36')).toBeNull()
  })
})
