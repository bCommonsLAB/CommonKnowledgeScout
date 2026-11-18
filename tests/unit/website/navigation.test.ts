/**
 * WE2 — Autoren-Links und Links im Sektions-Markdown laufen ueber die
 * Navigation-Schnittstelle: Ziel des Vokabulars → `weg`, absolute Adresse
 * unveraendert, fremde relative Adresse → `fremd`; ohne Antwort entfaellt der
 * Link (der Text bleibt) und es steht in der Konsole.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  autorenLink,
  bannerGalerieParams,
  bannerListe,
  listeAlsParameter,
  markdownLinksUeberNavigation,
  type WebsiteNavigation,
} from '@ks/module-website'

describe('autorenLink', () => {
  it('erkennt das Vokabular, absolute Adressen und den Rest', () => {
    expect(autorenLink('?view=gallery')).toEqual({ art: 'ziel', ziel: { art: 'galerie' } })
    expect(autorenLink(' ?mode=story ')).toEqual({ art: 'ziel', ziel: { art: 'story' } })
    expect(autorenLink('?site=kontakt')).toEqual({ art: 'ziel', ziel: { art: 'seite', seite: 'kontakt' } })
    expect(autorenLink('https://example.org/a')).toEqual({ art: 'extern', url: 'https://example.org/a' })
    expect(autorenLink('mailto:info@example.org')).toEqual({ art: 'extern', url: 'mailto:info@example.org' })
    expect(autorenLink('/explore/x')).toEqual({ art: 'fremd', href: '/explore/x' })
    expect(autorenLink('#anker')).toEqual({ art: 'fremd', href: '#anker' })
    expect(autorenLink('?view=gallery&doc=x')).toEqual({ art: 'fremd', href: '?view=gallery&doc=x' })
  })
})

describe('Banner-Liste', () => {
  it('stars ist die Rangliste, rating die Vorgabe — dieselben Parameter wie bannerGalerieParams', () => {
    expect(new URLSearchParams(listeAlsParameter(bannerListe('stars'))).toString()).toBe(bannerGalerieParams('stars'))
    expect(new URLSearchParams(listeAlsParameter(bannerListe('rating'))).toString()).toBe(bannerGalerieParams('rating'))
    expect(bannerListe(undefined)).toBeUndefined()
  })
})

describe('markdownLinksUeberNavigation', () => {
  afterEach(() => vi.restoreAllMocks())

  const html = [
    '<p><a href="?site=kontakt">Kontakt</a>',
    '<a href="?view=gallery" title="Alle">Archiv</a>',
    '<a href="https://example.org/?a=1&amp;b=2">Extern</a>',
    '<a href="/eigene/seite">Eigen</a></p>',
  ].join(' ')

  it('schreibt Ziele auf den Weg um und sammelt die Klicks', () => {
    const zurSeite = vi.fn()
    const nav: WebsiteNavigation = {
      weg: (ziel) => ziel.art === 'seite'
        ? { href: '/fragen?ks-site=kontakt', ausfuehren: zurSeite }
        : { href: '/inhalte' },
      fremd: (href) => href,
    }
    const { html: neu, klicks } = markdownLinksUeberNavigation(html, nav)
    expect(neu).toContain('<a href="/fragen?ks-site=kontakt">Kontakt</a>')
    expect(neu).toContain('<a href="/inhalte" title="Alle">Archiv</a>')
    expect(neu).toContain('<a href="https://example.org/?a=1&amp;b=2">Extern</a>')
    expect(neu).toContain('<a href="/eigene/seite">Eigen</a>')
    klicks.get('/fragen?ks-site=kontakt')?.()
    expect(zurSeite).toHaveBeenCalledTimes(1)
    expect(klicks.has('/inhalte')).toBe(false)
  })

  it('ohne Weg und ohne fremd: der Link entfaellt, der Text bleibt, die Konsole sagt es', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const nav: WebsiteNavigation = { weg: (ziel) => (ziel.art === 'galerie' ? { href: '/inhalte' } : null) }
    const { html: neu } = markdownLinksUeberNavigation(html, nav)
    expect(neu).toContain('<p>Kontakt <a href="/inhalte" title="Alle">Archiv</a>')
    expect(neu).toContain('Eigen</p>')
    expect(neu).not.toContain('/eigene/seite')
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/\?site=kontakt[\s\S]*\/eigene\/seite/)
  })

  it('verschluesselt die neue Adresse fuers Attribut', () => {
    const nav: WebsiteNavigation = { weg: () => ({ href: '/a?x=1&y="2"' }) }
    expect(markdownLinksUeberNavigation('<a href="?mode=story">S</a>', nav).html).toBe('<a href="/a?x=1&amp;y=&quot;2&quot;">S</a>')
  })
})
