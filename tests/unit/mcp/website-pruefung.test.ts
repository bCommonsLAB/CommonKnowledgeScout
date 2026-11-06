/**
 * B1 — Pruefung eines Markdown-Dokuments vor dem Publizieren.
 * Warnungen werden genannt, harte Fehler trennen Publizierbares von Kaputtem.
 */
import { describe, it, expect } from 'vitest'
import { bildUrls, pruefeMarkdownDokument } from '@/lib/mcp/website-pruefung'

const SEITE = [
  '---',
  'detailViewType: "website"',
  'title: "Startseite"',
  'language: "de"',
  'targetLanguage: "de"',
  'hero_image: "https://example.blob.core.windows.net/x/hero.jpg"',
  '---',
  '<!-- section layout=image-right bg=linen -->',
  '## Wer wir sind',
  '![Gruppe](https://example.blob.core.windows.net/x/gruppe.jpg)',
  'Text.',
  '<!-- /section -->',
].join('\n')

describe('pruefeMarkdownDokument', () => {
  it('saubere Website-Seite: keine Warnungen, keine Fehler, Typ erkannt', () => {
    const p = pruefeMarkdownDokument(SEITE)
    expect(p.fehler).toEqual([])
    expect(p.warnungen).toEqual([])
    expect(p.detailViewType).toBe('website')
    expect(p.meta.title).toBe('Startseite')
  })

  it('fehlender detailViewType ist eine Warnung, kein Fehler', () => {
    const p = pruefeMarkdownDokument('---\ntitle: "Notiz"\n---\nText')
    expect(p.fehler).toEqual([])
    expect(p.warnungen.some((w) => w.includes('detailViewType fehlt'))).toBe(true)
    expect(p.detailViewType).toBeNull()
  })

  it('unbekannter detailViewType ist ein harter Fehler', () => {
    const p = pruefeMarkdownDokument('---\ndetailViewType: "kaputt"\n---\nText')
    expect(p.fehler.some((f) => f.includes('Unbekannter detailViewType'))).toBe(true)
  })

  it('fehlende Pflichtfelder des Typs werden je Feld genannt', () => {
    const p = pruefeMarkdownDokument('---\ndetailViewType: "website"\ntitle: "A"\n---\nText')
    expect(p.warnungen).toContain('Pflichtfeld "language" fuer website fehlt')
    expect(p.warnungen).toContain('Pflichtfeld "targetLanguage" fuer website fehlt')
  })

  it('ungueltiger Sektions-Marker ist ein harter Fehler mit Parser-Meldung', () => {
    const md = SEITE.replace('layout=image-right', 'layout=kachel')
    const p = pruefeMarkdownDokument(md)
    expect(p.fehler.some((f) => f.startsWith('Sektions-Marker:') && f.includes('kachel'))).toBe(true)
  })

  it('F3: unbekannter banner_sort ist eine Warnung, stars und rating nicht', () => {
    const mitSort = (wert: string) => SEITE.replace('title: "Startseite"', `title: "Startseite"\nbanner_sort: "${wert}"`)
    const p = pruefeMarkdownDokument(mitSort('sterne'))
    expect(p.warnungen.some((w) => w.includes('banner_sort "sterne"'))).toBe(true)
    expect(pruefeMarkdownDokument(mitSort('stars')).warnungen).toEqual([])
  })

  it('relative Bild-URLs auf Website-Seiten sind eine Warnung (anonyme Besucher)', () => {
    const md = SEITE.replace('https://example.blob.core.windows.net/x/gruppe.jpg', 'bilder/gruppe.jpg')
    const p = pruefeMarkdownDokument(md)
    expect(p.warnungen.some((w) => w.includes('bilder/gruppe.jpg'))).toBe(true)
  })

  it('hero_layout: unbekannter Wert und none mit hero_image sind Warnungen', () => {
    const basis = '---\ndetailViewType: "website"\ntitle: "T"\n'
    const unbekannt = pruefeMarkdownDokument(basis + 'hero_layout: "split"\n---\n# T')
    expect(unbekannt.warnungen.some((w) => w.includes('hero_layout "split" ist unbekannt'))).toBe(true)
    const none = pruefeMarkdownDokument(basis + 'hero_layout: "none"\nhero_image: "https://b/h.jpg"\n---\n# T')
    expect(none.warnungen.some((w) => w.includes('hero_layout none mit hero_image'))).toBe(true)
    const sauber = pruefeMarkdownDokument(basis + 'hero_layout: "none"\n---\n# T')
    expect(sauber.warnungen.filter((w) => w.includes('hero_layout'))).toEqual([])
  })

  it('leerer Body ist ein harter Fehler', () => {
    const p = pruefeMarkdownDokument('---\ndetailViewType: "website"\n---\n   ')
    expect(p.fehler.some((f) => f.includes('Kein Text'))).toBe(true)
  })
})

describe('bildUrls', () => {
  it('findet alle Markdown-Bilder', () => {
    expect(bildUrls('a ![x](https://a/b.png) b ![](c/d.jpg)')).toEqual(['https://a/b.png', 'c/d.jpg'])
  })
})

describe('pruefeMarkdownDokument — Story-Sektion (Welle N1)', () => {
  const KOPF = ['---', 'detailViewType: "website"', 'title: "Startseite"', 'language: "de"', 'targetLanguage: "de"', '---'].join('\n')

  it('Story-Sektion mit Fragen: keine Warnung', () => {
    const p = pruefeMarkdownDokument(`${KOPF}\n<!-- section layout=story -->\n## Frag.\n<!-- questions -->\n- A?\n<!-- /section -->`)
    expect(p.fehler).toEqual([])
    expect(p.warnungen).toEqual([])
  })

  it('Story-Sektion ohne questions-Block ist eine Warnung', () => {
    const p = pruefeMarkdownDokument(`${KOPF}\n<!-- section layout=story -->\n## Frag.\n<!-- /section -->`)
    expect(p.fehler).toEqual([])
    expect(p.warnungen.some((w) => w.includes('ohne <!-- questions -->'))).toBe(true)
  })

  it('zwei Story-Sektionen sind ein harter Fehler des Parsers', () => {
    const p = pruefeMarkdownDokument(`${KOPF}\n<!-- section layout=story -->\nA\n<!-- /section -->\n<!-- section layout=story -->\nB\n<!-- /section -->`)
    expect(p.fehler.some((f) => f.includes('Hoechstens eine Sektion layout=story'))).toBe(true)
  })
})

describe('pruefeMarkdownDokument — Kacheln (Welle N2)', () => {
  const KOPF = ['---', 'detailViewType: "website"', 'title: "Startseite"', 'language: "de"', 'targetLanguage: "de"', '---'].join('\n')

  it('Kacheln mit gueltigen Zielen: weder Fehler noch Warnung', () => {
    const p = pruefeMarkdownDokument(`${KOPF}\n<!-- section layout=text-only -->\n<!-- cards -->\n- **Archiv** Stoebern. [Hin](?view=gallery)\n<!-- /section -->`)
    expect(p.fehler).toEqual([])
    expect(p.warnungen).toEqual([])
  })

  it('Kachel ohne Link oder mit unbekanntem Ziel verhindert das Publizieren', () => {
    const ohneLink = pruefeMarkdownDokument(`${KOPF}\n<!-- section layout=text-only -->\n<!-- cards -->\n- **Archiv** Nur Text\n<!-- /section -->`)
    expect(ohneLink.fehler.some((f) => f.includes('Karten-Zeile'))).toBe(true)
    const falschesZiel = pruefeMarkdownDokument(`${KOPF}\n<!-- section layout=text-only -->\n<!-- cards -->\n- **Archiv** [Hin](?view=karte)\n<!-- /section -->`)
    expect(falschesZiel.fehler.some((f) => f.includes('view="karte"'))).toBe(true)
  })
})
