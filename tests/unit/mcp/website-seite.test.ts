/**
 * B5 — Seitenbericht aus website-Docs: Menue, Footer, Sektionen, Befunde.
 */
import { describe, it, expect } from 'vitest'
import type { DocCardMeta } from '@ks/contracts'
import { baueSeitenBericht } from '@/lib/mcp/website-seite'

function doc(over: Partial<DocCardMeta>): DocCardMeta {
  return { id: over.fileId ?? 'x', fileId: 'x', title: 'Doc', detailViewType: 'website', ...over } as DocCardMeta
}

const HOME = doc({ fileId: 'home', title: 'Startseite', menu_order: 1, slug: 'start' })
const KONTAKT = doc({ fileId: 'kontakt', title: 'Kontakt', menu_order: 8, slug: 'kontakt' })
const IMPRESSUM = doc({ fileId: 'impressum', title: 'Impressum', menu_area: 'footer', menu_order: 20 })
const FOOTER = doc({ fileId: 'footer', title: '#tag', site_role: 'footer-content', menu_area: 'hidden', menu_order: 99 })

const HOME_MD = '<!-- section layout=image-right bg=linen -->\n## Hi\n![a](https://blob/a.jpg)\nText [Mitmachen](?site=kontakt)\n<!-- /section -->'

describe('baueSeitenBericht', () => {
  it('ordnet Menue, Footer-Links und Footer-Doc wie der Renderer', () => {
    const b = baueSeitenBericht([FOOTER, IMPRESSUM, KONTAKT, HOME], new Map([
      ['home', HOME_MD], ['kontakt', '<!-- section layout=contact-form -->\n## K\n<!-- /section -->'],
      ['impressum', 'Text'], ['footer', '<!-- section layout=text-only bg=dark-green -->\n## F\n<!-- /section -->'],
    ]))
    expect(b.startseite).toBe('Startseite')
    expect(b.menue).toEqual(['Startseite', 'Kontakt'])
    expect(b.footerLinks).toEqual(['Impressum'])
    expect(b.footerDoc).toBe('#tag')
    expect(b.hinweise).toEqual([])
    const home = b.seiten.find((s) => s.fileId === 'home')
    expect(home?.sektionen).toEqual([{ layout: 'image-right', bg: 'linen', bild: true }])
    expect(home?.fehler).toEqual([])
  })

  it('meldet ungueltige Marker, tote ?site=-Links und relative Bilder je Seite', () => {
    const md = '<!-- section layout=kachel -->\n## X\n![b](bilder/b.jpg)\n[L](?site=gibtsnicht)\n<!-- /section -->'
    const b = baueSeitenBericht([HOME], new Map([['home', md]]))
    const home = b.seiten[0]
    expect(home.fehler.some((f) => f.includes('kachel'))).toBe(true)
    expect(home.fehler).toContain('Link ?site=gibtsnicht trifft kein website-Doc')
    expect(home.warnungen.some((w) => w.includes('bilder/b.jpg'))).toBe(true)
  })

  it('fehlendes Markdown und fehlender menu_order sind Befunde am Doc', () => {
    const b = baueSeitenBericht([doc({ fileId: 'k', title: 'K' })], new Map())
    expect(b.seiten[0].fehler).toContain('Kein Markdown im Meta-Dokument — Seite rendert leer')
    expect(b.seiten[0].warnungen.some((w) => w.includes('menu_order fehlt'))).toBe(true)
  })

  it('ohne website-Docs sagt der Hinweis, dass die Landingpage leer bleibt', () => {
    const b = baueSeitenBericht([], new Map())
    expect(b.startseite).toBeNull()
    expect(b.hinweise[0]).toMatch(/Keine website-Docs/)
  })

  it('nur Footer-Docs: kein Hauptmenue, keine Startseite', () => {
    const b = baueSeitenBericht([FOOTER], new Map([['footer', 'x']]))
    expect(b.startseite).toBeNull()
    expect(b.hinweise.some((h) => h.includes('Kein Doc im Hauptmenue'))).toBe(true)
  })
})
