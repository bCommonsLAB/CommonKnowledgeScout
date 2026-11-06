/**
 * Welle N2 — Zielaufloesung der Kacheln: bekannte Ziele, explizite Fehler,
 * und was der Klick daraus macht (Rueckruf ohne Neuladen oder Link).
 */
import { describe, it, expect, vi } from 'vitest'
import { kartenaktion, loeseKartenziel } from '@/lib/website/kartenziel'

describe('loeseKartenziel', () => {
  it('loest die vier Zielarten auf', () => {
    expect(loeseKartenziel('?view=gallery')).toEqual({ art: 'galerie' })
    expect(loeseKartenziel('?mode=story')).toEqual({ art: 'story' })
    expect(loeseKartenziel('?site=wie-funktioniert')).toEqual({ art: 'seite', slug: 'wie-funktioniert' })
    expect(loeseKartenziel('https://example.org/a?b=1')).toEqual({ art: 'extern', url: 'https://example.org/a?b=1' })
    expect(loeseKartenziel('  http://example.org  ')).toEqual({ art: 'extern', url: 'http://example.org' })
  })

  it('dekodiert den Seiten-Slug', () => {
    expect(loeseKartenziel('?site=ueber%20uns')).toEqual({ art: 'seite', slug: 'ueber uns' })
  })

  it('wirft bei unbekanntem Ziel, nennt die erlaubten', () => {
    expect(() => loeseKartenziel('')).toThrow(/unbekannt \(erlaubt: \?view=gallery/)
    expect(() => loeseKartenziel('/explore/x')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('javascript:alert(1)')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('ftp://example.org')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('?view=site')).toThrow(/view="site"/)
    expect(() => loeseKartenziel('?mode=chat')).toThrow(/mode="chat"/)
    expect(() => loeseKartenziel('?site=')).toThrow(/ohne Seite/)
    expect(() => loeseKartenziel('?foo=bar')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('?view=gallery&doc=x')).toThrow(/weiteren Parametern/)
  })
})

describe('kartenaktion', () => {
  it('ohne Navigation: reine Links', () => {
    expect(kartenaktion({ art: 'galerie' })).toEqual({ href: '?view=gallery', ausfuehren: undefined, extern: false })
    expect(kartenaktion({ art: 'story' })).toMatchObject({ href: '?mode=story', ausfuehren: undefined })
    expect(kartenaktion({ art: 'seite', slug: 'a b' })).toMatchObject({ href: '?site=a%20b', ausfuehren: undefined })
    expect(kartenaktion({ art: 'extern', url: 'https://example.org' })).toEqual({ href: 'https://example.org', extern: true })
  })

  it('Site-Modus: Rueckrufe wechseln die Ansicht ohne Neuladen', () => {
    const onShowGallery = vi.fn()
    const onShowStory = vi.fn()
    const onShowSite = vi.fn()
    const nav = { onShowGallery, onShowStory, onShowSite }
    kartenaktion({ art: 'galerie' }, nav).ausfuehren?.()
    kartenaktion({ art: 'story' }, nav).ausfuehren?.()
    kartenaktion({ art: 'seite', slug: 'wie-funktioniert' }, nav).ausfuehren?.()
    expect(onShowGallery).toHaveBeenCalledWith()
    expect(onShowStory).toHaveBeenCalledTimes(1)
    expect(onShowSite).toHaveBeenCalledWith('wie-funktioniert')
  })

  it('Root-Modus: Adressen der Explore-Seite, kein Rueckruf fuer Galerie und Story', () => {
    const nav = { galleryBaseHref: '/explore/x?view=gallery', storyBaseHref: '/explore/x?mode=story' }
    expect(kartenaktion({ art: 'galerie' }, nav)).toEqual({ href: '/explore/x?view=gallery', ausfuehren: undefined, extern: false })
    expect(kartenaktion({ art: 'story' }, nav)).toMatchObject({ href: '/explore/x?mode=story', ausfuehren: undefined })
  })
})
