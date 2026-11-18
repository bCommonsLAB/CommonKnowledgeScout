// @vitest-environment jsdom
/**
 * Navigation der Story-Sektion (Owner 10.11.2026): ein Beleg oeffnet die
 * Detailansicht ueber der Startseite, wenn sein Dokument hier geladen ist;
 * sonst geht es — gemeldet — wie bisher in die Galerie. Seit WE3 ueber
 * `WebsiteNavigation` (Ziel `dokument` bzw. `galerie`) statt Router.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { appNavigation } from '@ks/module-website'
import { useWebsiteStoryNavigation } from '@ks/module-website/react'

afterEach(() => vi.restoreAllMocks())

describe('useWebsiteStoryNavigation', () => {
  it('oeffnet lokal (mit Seite) und beruehrt die Galerie nicht', () => {
    const onShowGallery = vi.fn()
    const oeffneLokal = vi.fn().mockReturnValue(true)
    const { result } = renderHook(() => useWebsiteStoryNavigation(appNavigation({ onShowGallery }), vi.fn(), oeffneLokal))
    result.current.nav.openDocument('talk-a', { page: 3 })
    expect(oeffneLokal).toHaveBeenCalledWith('talk-a', 3)
    expect(onShowGallery).not.toHaveBeenCalled()
  })

  it('unbekanntes Dokument: Meldung und Weg in die Galerie; ohne oeffneLokal wie bisher ohne Meldung', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onShowGallery = vi.fn()
    const mit = renderHook(() => useWebsiteStoryNavigation(appNavigation({ onShowGallery }), vi.fn(), () => false))
    mit.result.current.nav.openDocument('fremd')
    expect(onShowGallery).toHaveBeenCalledWith({ doc: 'fremd' })
    expect(warn).toHaveBeenCalledTimes(1)
    const geheZu = vi.fn()
    const ohne = renderHook(() => useWebsiteStoryNavigation(appNavigation({ galleryBaseHref: '/explore/x?view=gallery', geheZu }), vi.fn()))
    ohne.result.current.nav.openDocument('talk-b')
    expect(geheZu).toHaveBeenCalledWith('/explore/x?view=gallery&doc=talk-b')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('Katalog: Weg in die ganze Galerie', () => {
    const onShowGallery = vi.fn()
    const { result } = renderHook(() => useWebsiteStoryNavigation(appNavigation({ onShowGallery }), vi.fn()))
    result.current.zurGalerie({})
    expect(onShowGallery).toHaveBeenCalledWith(undefined)
  })

  it('Weg nur als Adresse oder gar nicht: laut in der Konsole, kein stiller Klick', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nurAdresse = renderHook(() => useWebsiteStoryNavigation({ weg: () => ({ href: '/inhalte?ks-doc=x' }) }, vi.fn()))
    nurAdresse.result.current.nav.openDocument('x')
    expect(error.mock.calls[0][0]).toMatch(/nur eine Adresse/)
    const ohneWeg = renderHook(() => useWebsiteStoryNavigation({ weg: () => null }, vi.fn()))
    ohneWeg.result.current.zurGalerie({})
    expect(warn).toHaveBeenCalled()
  })
})
