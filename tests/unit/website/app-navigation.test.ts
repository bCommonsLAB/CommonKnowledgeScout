/**
 * WE2 — die Navigation der App als `WebsiteNavigation`: dieselben Adressen und
 * Rueckrufe wie vorher `kartenaktion` (Kacheln), das Banner (`router.push`,
 * `onShowGallery`) und die Fusszeile (`onNavigate`).
 */
import { describe, it, expect, vi } from 'vitest'
import { appNavigation, bannerKartenHref, bannerKartenParams, bannerGalerieParams, bannerListe } from '@ks/module-website'

describe('appNavigation', () => {
  it('ohne Modus: reine Links mit den KnowledgeScout-Adressen', () => {
    const nav = appNavigation()
    expect(nav.weg({ art: 'galerie' })).toEqual({ href: '?view=gallery' })
    expect(nav.weg({ art: 'story' })).toEqual({ href: '?mode=story' })
    expect(nav.weg({ art: 'seite', seite: 'a b' })).toEqual({ href: '?site=a%20b', ausfuehren: undefined })
    expect(nav.fremd('/irgendwo')).toBe('/irgendwo')
  })

  it('Site-Modus: Rueckrufe wechseln die Ansicht ohne Neuladen', () => {
    const onShowGallery = vi.fn()
    const onShowStory = vi.fn()
    const onShowSite = vi.fn()
    const nav = appNavigation({ onShowGallery, onShowStory, onShowSite })
    nav.weg({ art: 'galerie' }).ausfuehren?.()
    nav.weg({ art: 'story' }).ausfuehren?.()
    nav.weg({ art: 'seite', seite: 'wie-funktioniert' }).ausfuehren?.()
    expect(onShowGallery).toHaveBeenCalledWith(undefined)
    expect(onShowStory).toHaveBeenCalledWith(undefined)
    expect(onShowSite).toHaveBeenCalledWith('wie-funktioniert')
  })

  it('Site-Modus: Banner-Liste und Karte bringen dieselben Parameter mit wie vorher', () => {
    const onShowGallery = vi.fn()
    const nav = appNavigation({ onShowGallery })
    const mehr = nav.weg({ art: 'galerie', liste: bannerListe('stars') })
    expect(mehr.href).toBe(`?view=gallery&${bannerGalerieParams('stars')}`)
    mehr.ausfuehren?.()
    expect(onShowGallery).toHaveBeenLastCalledWith(Object.fromEntries(new URLSearchParams(bannerGalerieParams('stars'))))
    nav.weg({ art: 'dokument', slug: 'karte-1', liste: bannerListe('stars') }).ausfuehren?.()
    expect(onShowGallery).toHaveBeenLastCalledWith(bannerKartenParams('stars', 'karte-1'))
    nav.weg({ art: 'dokument', slug: 'karte-2', liste: bannerListe('rating') }).ausfuehren?.()
    expect(onShowGallery).toHaveBeenLastCalledWith(bannerKartenParams('rating', 'karte-2'))
  })

  it('Root-Modus: Adressen der Explore-Seite; geheZu wechselt ohne Neuladen', () => {
    const geheZu = vi.fn()
    const basis = '/explore/x?view=gallery'
    const nav = appNavigation({ galleryBaseHref: basis, storyBaseHref: '/explore/x?mode=story', geheZu })
    const karte = nav.weg({ art: 'dokument', slug: 'karte-1', liste: bannerListe('stars') })
    expect(karte.href).toBe(bannerKartenHref(basis, 'stars', 'karte-1'))
    karte.ausfuehren?.()
    expect(geheZu).toHaveBeenCalledWith(karte.href)
    expect(nav.weg({ art: 'galerie', liste: bannerListe('rating') }).href).toBe(basis)
    expect(nav.weg({ art: 'story', frage: 'q-1' }).href).toBe('/explore/x?mode=story&q=q-1')
  })

  it('Root-Modus ohne geheZu: reine Links, kein Rueckruf fuer Galerie und Story', () => {
    const nav = appNavigation({ galleryBaseHref: '/explore/x?view=gallery', storyBaseHref: '/explore/x?mode=story' })
    expect(nav.weg({ art: 'galerie' })).toEqual({ href: '/explore/x?view=gallery', ausfuehren: undefined })
    expect(nav.weg({ art: 'story' })).toEqual({ href: '/explore/x?mode=story', ausfuehren: undefined })
  })

  it('Story mit Frage: q in Adresse und Rueckruf; Dokument mit Seitenzahl: page', () => {
    const onShowStory = vi.fn()
    const nav = appNavigation({ onShowStory })
    const weg = nav.weg({ art: 'story', frage: 'abc' })
    expect(weg.href).toBe('?mode=story&q=abc')
    weg.ausfuehren?.()
    expect(onShowStory).toHaveBeenCalledWith({ q: 'abc' })
    expect(appNavigation().weg({ art: 'dokument', slug: 's', seitenzahl: 3 }).href).toBe('?view=gallery&doc=s&page=3')
  })
})
