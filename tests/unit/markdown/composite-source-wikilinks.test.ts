/**
 * @fileoverview Unit-Tests fuer `replaceCompositeSourceWikilinksWithLinks`.
 *
 * Hintergrund: Im `## Quellen`-Block (und allgemein) erscheinen Wikilinks der
 * Form `[[name.ext]]`. Der Standard-Markdown-Renderer ignoriert diese Syntax
 * und liefert leere Listenpunkte. Dieser Helper transformiert sie in normale
 * `<a>`-Tags, sodass:
 *  - Obsidian-Style sichtbar bleibt (Dateiname als Link-Text),
 *  - der bestehende Composite-Click-Handler in `markdown-preview.tsx` die
 *    Navigation per `siblingNameToId` aufloest.
 */

import { describe, it, expect } from 'vitest'
import { replaceCompositeSourceWikilinksWithLinks } from '@/lib/markdown/composite-wiki-preview'

describe('replaceCompositeSourceWikilinksWithLinks', () => {
  it('ersetzt einen einfachen [[name.ext]]-Wikilink durch ein <a>-Tag mit Dateiname', () => {
    const md = '1. [[a.jpeg]]'
    const out = replaceCompositeSourceWikilinksWithLinks(md)
    expect(out).toContain('<a')
    expect(out).toContain('href="a.jpeg"')
    expect(out).toContain('data-ks-source-name="a.jpeg"')
    expect(out).toContain('>a.jpeg</a>')
  })

  it('laesst Embed-Syntax `![[name.ext]]` unangetastet (Bilder werden vom Vorschau-Block-Helper behandelt)', () => {
    const md = '![[a.jpeg]]'
    expect(replaceCompositeSourceWikilinksWithLinks(md)).toBe(md)
  })

  it('laesst PDF-Fragment-Wikilinks `[[doc.pdf#frag.png]]` unangetastet (separater Helper)', () => {
    const md = '- [[doc.pdf#img-0.png]]'
    expect(replaceCompositeSourceWikilinksWithLinks(md)).toBe(md)
  })

  it('laesst Wikilinks ohne Dateierweiterung unangetastet (interne Obsidian-Page-Links)', () => {
    const md = '[[Mein Artikel]]'
    expect(replaceCompositeSourceWikilinksWithLinks(md)).toBe(md)
  })

  it('laesst Pipe-Alias-Syntax `[[name|alias]]` unangetastet (nicht im Scope dieses Helpers)', () => {
    const md = '[[a.jpeg|Anzeigename]]'
    expect(replaceCompositeSourceWikilinksWithLinks(md)).toBe(md)
  })

  it('ersetzt mehrere Wikilinks in einer Zeile', () => {
    const md = '[[a.jpeg]] und [[b.png]]'
    const out = replaceCompositeSourceWikilinksWithLinks(md)
    expect(out).toContain('href="a.jpeg"')
    expect(out).toContain('href="b.png"')
  })

  it('escaped Sonderzeichen im Dateinamen', () => {
    const md = '[[bild "test".jpeg]]'
    const out = replaceCompositeSourceWikilinksWithLinks(md)
    expect(out).toContain('href="bild &quot;test&quot;.jpeg"')
    expect(out).toContain('data-ks-source-name="bild &quot;test&quot;.jpeg"')
  })

  it('verarbeitet einen kompletten Quellen-Block korrekt', () => {
    const md = [
      '## Quellen',
      '1. [[a.jpeg]]',
      '2. [[b.jpeg]]',
      '3. [[c.png]]',
      '',
      '## Vorschau',
      '![[a.jpeg]]',
    ].join('\n')

    const out = replaceCompositeSourceWikilinksWithLinks(md)

    expect(out).toContain('href="a.jpeg"')
    expect(out).toContain('href="b.jpeg"')
    expect(out).toContain('href="c.png"')
    expect(out).toContain('![[a.jpeg]]')
    expect(out).toContain('## Quellen')
    expect(out).toContain('## Vorschau')
  })

  it('akzeptiert verschiedene Bild-Erweiterungen', () => {
    const cases = ['photo.jpeg', 'photo.jpg', 'icon.png', 'anim.gif', 'modern.webp', 'doc.pdf', 'audio.mp3']
    for (const name of cases) {
      const md = `[[${name}]]`
      const out = replaceCompositeSourceWikilinksWithLinks(md)
      expect(out).toContain(`href="${name}"`)
    }
  })

  it('verschluckt nicht den umgebenden Text', () => {
    const md = 'Vor [[a.jpeg]] danach'
    const out = replaceCompositeSourceWikilinksWithLinks(md)
    expect(out.startsWith('Vor ')).toBe(true)
    expect(out.endsWith(' danach')).toBe(true)
  })
})
