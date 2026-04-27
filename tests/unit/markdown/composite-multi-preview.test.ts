/**
 * @fileoverview Unit-Tests fuer `replaceCompositeMultiPreviewBlock` (S7).
 */

import { describe, it, expect } from 'vitest'
import { replaceCompositeMultiPreviewBlock } from '@/lib/markdown/composite-multi-preview'

describe('replaceCompositeMultiPreviewBlock', () => {
  it('ersetzt den Vorschau-Block durch einen Bild-Grid mit Platzhaltern', () => {
    const md = [
      '# Bild-Sammelanalyse',
      '',
      '## Quellen',
      '1. [[a.jpeg]]',
      '2. [[b.jpeg]]',
      '',
      '## Vorschau',
      '',
      '![[a.jpeg]]',
      '',
      '![[b.jpeg]]',
      '',
    ].join('\n')

    const out = replaceCompositeMultiPreviewBlock(md)

    expect(out).toContain('## Vorschau')
    expect(out).toContain('ks-composite-multi-grid')
    expect(out).toContain('data-composite-multi-source="a.jpeg"')
    expect(out).toContain('data-composite-multi-source="b.jpeg"')
    expect(out).toContain('alt="a.jpeg"')
    expect(out).toContain('alt="b.jpeg"')
    // Quellen-Block bleibt unangetastet, damit der Wikilink-Listenpfad
    // weiterhin funktioniert.
    expect(out).toContain('## Quellen')
    expect(out).toContain('[[a.jpeg]]')
  })

  it('liefert den Input unveraendert zurueck, wenn kein Vorschau-Block existiert', () => {
    const md = '# Foo\n\n## Quellen\n1. [[a.jpeg]]\n'
    expect(replaceCompositeMultiPreviewBlock(md)).toBe(md)
  })

  it('liefert den Input unveraendert zurueck, wenn der Vorschau-Block leer ist', () => {
    const md = '## Vorschau\n\n## Andere\n'
    expect(replaceCompositeMultiPreviewBlock(md)).toBe(md)
  })

  it('escaped Sonderzeichen im Dateinamen', () => {
    const md = '## Vorschau\n\n![[bild "test".jpeg]]\n'
    const out = replaceCompositeMultiPreviewBlock(md)
    // Anfuehrungszeichen muessen im HTML-Attribut escaped sein.
    expect(out).toContain('data-composite-multi-source="bild &quot;test&quot;.jpeg"')
    expect(out).not.toContain('data-composite-multi-source="bild "test".jpeg"')
  })

  it('beendet den Vorschau-Block am naechsten Heading', () => {
    const md = [
      '## Vorschau',
      '',
      '![[a.jpeg]]',
      '',
      '## Notizen',
      '',
      '![[b.jpeg]]',
    ].join('\n')

    const out = replaceCompositeMultiPreviewBlock(md)

    // a.jpeg ist im Grid (Vorschau), b.jpeg bleibt klartext (Notizen)
    expect(out).toContain('data-composite-multi-source="a.jpeg"')
    expect(out).not.toContain('data-composite-multi-source="b.jpeg"')
    expect(out).toContain('![[b.jpeg]]')
  })
})
