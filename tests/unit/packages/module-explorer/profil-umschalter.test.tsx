// @vitest-environment jsdom

/**
 * G1: Umschalter Einfach | Experte — für alle sichtbar, schreibt ?ansicht=.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ProfilUmschalter } from '@ks/module-explorer/gallery/components/profil-umschalter'

const pushMock = vi.fn()
let currentSearch = ''
let mockStandardProfil: string | undefined

vi.mock('@ks/module-explorer/gallery/contexts/gallery-navigation-context', () => ({
  useGalleryNavigation: () => ({
    params: new URLSearchParams(currentSearch),
    pushParams: (next: URLSearchParams) => pushMock(next.toString()),
  }),
}))
vi.mock('@ks/shell/react', () => ({
  useLibraries: () => [{ id: 'lib-1', config: { chat: { gallery: { standardProfil: mockStandardProfil } } } }],
}))
vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
    locale: 'de',
  }),
}))

describe('ProfilUmschalter', () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearch = ''
    mockStandardProfil = undefined
  })
  afterEach(() => cleanup())

  it('ohne Adresse und Config ist Experte aktiv; Klick auf Einfach schreibt ansicht=gefuehrt', () => {
    render(<ProfilUmschalter libraryId="lib-1" />)
    expect(screen.getByTitle('Experte').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Einfach').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByTitle('Einfach'))
    expect(String(pushMock.mock.calls[0][0])).toBe('ansicht=gefuehrt')
  })

  it('Config gefuehrt macht Einfach aktiv; Klick auf das aktive Segment schreibt nichts', () => {
    mockStandardProfil = 'gefuehrt'
    render(<ProfilUmschalter libraryId="lib-1" />)
    expect(screen.getByTitle('Einfach').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTitle('Einfach'))
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('Adresse schlägt Config und andere Parameter bleiben erhalten', () => {
    mockStandardProfil = 'gefuehrt'
    currentSearch = 'ansicht=experte&starred=1'
    render(<ProfilUmschalter libraryId="lib-1" />)
    expect(screen.getByTitle('Experte').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTitle('Einfach'))
    expect(String(pushMock.mock.calls[0][0])).toBe('ansicht=gefuehrt&starred=1')
  })
})
