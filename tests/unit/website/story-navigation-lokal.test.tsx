// @vitest-environment jsdom
/**
 * Navigation der Story-Sektion (Owner 10.11.2026): ein Beleg oeffnet die
 * Detailansicht ueber der Startseite, wenn sein Dokument hier geladen ist;
 * sonst geht es — gemeldet — wie bisher in die Galerie.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWebsiteStoryNavigation } from '@/components/library/website/story/use-website-story-navigation'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

afterEach(() => vi.clearAllMocks())

describe('useWebsiteStoryNavigation', () => {
  it('oeffnet lokal (mit Seite) und beruehrt die Galerie nicht', () => {
    const onShowGallery = vi.fn()
    const oeffneLokal = vi.fn().mockReturnValue(true)
    const { result } = renderHook(() => useWebsiteStoryNavigation({ onShowGallery, galleryBaseHref: null, storyBaseHref: null }, vi.fn(), oeffneLokal))
    result.current.nav.openDocument('talk-a', { page: 3 })
    expect(oeffneLokal).toHaveBeenCalledWith('talk-a', 3)
    expect(onShowGallery).not.toHaveBeenCalled()
  })

  it('unbekanntes Dokument: Meldung und Weg in die Galerie; ohne oeffneLokal wie bisher ohne Meldung', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onShowGallery = vi.fn()
    const mit = renderHook(() => useWebsiteStoryNavigation({ onShowGallery, galleryBaseHref: null, storyBaseHref: null }, vi.fn(), () => false))
    mit.result.current.nav.openDocument('fremd')
    expect(onShowGallery).toHaveBeenCalledWith({ doc: 'fremd' })
    expect(warn).toHaveBeenCalledTimes(1)
    const ohne = renderHook(() => useWebsiteStoryNavigation({ galleryBaseHref: '/explore/x?view=gallery', storyBaseHref: null }, vi.fn()))
    ohne.result.current.nav.openDocument('talk-b')
    expect(push).toHaveBeenCalledWith('/explore/x?view=gallery&doc=talk-b')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
