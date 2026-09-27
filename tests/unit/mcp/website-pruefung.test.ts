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

  it('relative Bild-URLs auf Website-Seiten sind eine Warnung (anonyme Besucher)', () => {
    const md = SEITE.replace('https://example.blob.core.windows.net/x/gruppe.jpg', 'bilder/gruppe.jpg')
    const p = pruefeMarkdownDokument(md)
    expect(p.warnungen.some((w) => w.includes('bilder/gruppe.jpg'))).toBe(true)
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
