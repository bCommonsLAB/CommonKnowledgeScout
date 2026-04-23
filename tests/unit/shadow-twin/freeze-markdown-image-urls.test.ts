/**
 * @fileoverview Tests fuer freezeMarkdownImageUrls()
 *
 * Verifiziert, dass relative Bildpfade in Markdown- und HTML-Syntax deterministisch
 * gegen absolute Azure-URLs ersetzt werden, indem `binaryFragments` herangezogen werden.
 */

import { describe, it, expect } from 'vitest'
import { freezeMarkdownImageUrls } from '@/lib/shadow-twin/media-persistence-service'

const fragments = [
  {
    name: 'img-0.jpeg',
    hash: 'aabbccdd11223344',
    url: 'https://blob.example/cnt/lib/books/src/aabbccdd11223344.jpeg',
    mimeType: 'image/jpeg',
  },
  {
    name: 'img-1.png',
    hash: 'deadbeef',
    originalName: 'legacy.png',
    url: 'https://blob.example/cnt/lib/books/src/deadbeef.png',
    mimeType: 'image/png',
  },
]

describe('freezeMarkdownImageUrls', () => {
  it('ersetzt ![alt](relativer/pfad) durch absolute URL', () => {
    const md = `Bild: ![alt](img-0.jpeg)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(1)
    expect(r.markdown).toContain('https://blob.example/cnt/lib/books/src/aabbccdd11223344.jpeg')
    expect(r.unresolved).toEqual([])
  })

  it('ersetzt mehrere Bilder in einem Lauf', () => {
    const md = `![](img-0.jpeg)\n\n![Logo](img-1.png)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(2)
    expect(r.unresolved).toEqual([])
  })

  it('loest Hash-Form auf (transkript-Form)', () => {
    const md = `![](aabbccdd11223344.jpeg)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(1)
    expect(r.markdown).toContain('aabbccdd11223344.jpeg')
    expect(r.markdown.startsWith('![](https://')).toBe(true)
  })

  it('loest originalName auf (legacy.png)', () => {
    const md = `![](legacy.png)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(1)
    expect(r.markdown).toContain('deadbeef.png')
  })

  it('ersetzt <img src="..."> Tags', () => {
    const md = `<img src="img-0.jpeg" alt="x" class="w-full">`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(1)
    expect(r.markdown).toContain('https://blob.example/cnt/lib/books/src/aabbccdd11223344.jpeg')
  })

  it('laesst absolute URLs unangetastet', () => {
    const md = `![](https://other.example/foo.jpeg)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(0)
    expect(r.unresolved).toEqual([])
    expect(r.markdown).toBe(md)
  })

  it('laesst data:-URIs unangetastet', () => {
    const md = `![](data:image/png;base64,AAA)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(0)
    expect(r.markdown).toBe(md)
  })

  it('laesst /api/-Pfade unangetastet (Streaming-URL-Indirektion)', () => {
    const md = `![](/api/storage/streaming-url?fileId=x&libraryId=y)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(0)
    expect(r.markdown).toBe(md)
  })

  it('sammelt unaufloesbare Pfade in unresolved', () => {
    const md = `![](unbekannt.jpeg)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(0)
    expect(r.unresolved).toEqual(['unbekannt.jpeg'])
    expect(r.markdown).toBe(md)
  })

  it('akzeptiert Pfade mit Ordner-Praefix (img-0.jpeg im Twin-Ordner)', () => {
    const md = `![](_quelle.pdf/img-0.jpeg)`
    const r = freezeMarkdownImageUrls(md, fragments)
    expect(r.replacedCount).toBe(1)
    expect(r.markdown.startsWith('![](https://')).toBe(true)
  })

  it('liefert leeres Ergebnis bei leeren binaryFragments', () => {
    const md = `![](img-0.jpeg)`
    const r = freezeMarkdownImageUrls(md, [])
    expect(r.replacedCount).toBe(0)
    expect(r.markdown).toBe(md)
  })

  it('liefert leeres Ergebnis bei null/undefined binaryFragments', () => {
    const md = `![](img-0.jpeg)`
    expect(freezeMarkdownImageUrls(md, null).markdown).toBe(md)
    expect(freezeMarkdownImageUrls(md, undefined).markdown).toBe(md)
  })
})
