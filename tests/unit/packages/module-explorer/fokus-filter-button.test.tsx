// @vitest-environment jsdom

/**
 * Welle F2 (ADR 0012): Knopf „Im Fokus" — Adress-Logik (starred=1 und
 * sort=stars gemeinsam) und Sichtbarkeit je Rolle und Schalter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import {
  FokusFilterButton,
  fokusAktiv,
  fokusUmschalten,
} from '@ks/module-explorer/gallery/components/fokus-filter-button'

const pushMock = vi.fn()
let currentSearch = ''
let mockIsMember = false
let mockStarCountsPublic = false

vi.mock('@ks/module-explorer/gallery/contexts/gallery-navigation-context', () => ({
  useGalleryNavigation: () => ({
    params: new URLSearchParams(currentSearch),
    pushParams: (next: URLSearchParams) => pushMock(next.toString()),
  }),
}))
vi.mock('@ks/module-explorer/gallery/hooks/use-star-counts-public', () => ({
  useSterneSichtbar: () => ({
    isMember: mockIsMember,
    starCountsPublic: mockStarCountsPublic,
    sterneSichtbar: mockIsMember || mockStarCountsPublic,
  }),
}))
vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
    locale: 'de',
  }),
}))

describe('fokusAktiv / fokusUmschalten', () => {
  it('aktiv nur bei starred=1', () => {
    expect(fokusAktiv(new URLSearchParams(''))).toBe(false)
    expect(fokusAktiv(new URLSearchParams('starred=1'))).toBe(true)
    expect(fokusAktiv(new URLSearchParams('starred=2'))).toBe(false)
    expect(fokusAktiv(null)).toBe(false)
  })

  it('einschalten setzt starred=1 und sort=stars, andere Params bleiben', () => {
    const next = fokusUmschalten(new URLSearchParams('handlungsfeld=Energie'))
    expect(next.get('starred')).toBe('1')
    expect(next.get('sort')).toBe('stars')
    expect(next.get('handlungsfeld')).toBe('Energie')
  })

  it('ausschalten entfernt starred und das eigene sort=stars', () => {
    const next = fokusUmschalten(new URLSearchParams('starred=1&sort=stars&favorites=1'))
    expect(next.has('starred')).toBe(false)
    expect(next.has('sort')).toBe(false)
    expect(next.get('favorites')).toBe('1')
  })

  it('ausschalten laesst eine andere Sortierung stehen', () => {
    const next = fokusUmschalten(new URLSearchParams('starred=1&sort=rating'))
    expect(next.has('starred')).toBe(false)
    expect(next.get('sort')).toBe('rating')
  })
})

describe('FokusFilterButton', () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearch = ''
    mockIsMember = false
    mockStarCountsPublic = false
  })
  afterEach(() => cleanup())

  it('Besucher ohne Schalter: kein Knopf', () => {
    render(<FokusFilterButton libraryId="lib-1" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('Besucher mit Schalter: Knopf da, Klick setzt beide Params', () => {
    mockStarCountsPublic = true
    render(<FokusFilterButton libraryId="lib-1" />)
    const knopf = screen.getByRole('button')
    expect(knopf.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(knopf)
    expect(String(pushMock.mock.calls[0][0])).toBe('starred=1&sort=stars')
  })

  it('Mitglied ohne Schalter: Knopf da, aktiv bei starred=1', () => {
    mockIsMember = true
    currentSearch = 'starred=1&sort=stars'
    render(<FokusFilterButton libraryId="lib-1" />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })
})
