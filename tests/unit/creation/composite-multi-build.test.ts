/**
 * @fileoverview Unit-Tests für `buildCompositeMultiReference`.
 *
 * Geprüft wird:
 * - Frontmatter (kind, _source_files, createdAt)
 * - Quellen-Liste in Reihenfolge
 * - Wiki-Embeds für jede Bilddatei
 * - Validierung: <2 Quellen, >10 Quellen, Nicht-Bild-Quelle
 */

import { describe, expect, it } from 'vitest'
import {
  buildCompositeMultiReference,
  COMPOSITE_MULTI_MAX_IMAGES,
} from '@/lib/creation/composite-multi'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'

// Hilfs-Konstruktor: erzeugt SourceItem-Trio in der Test-Reihenfolge.
function img(name: string, idx: number) {
  return { id: `id-${idx}`, name, parentId: 'parent-1' }
}

describe('buildCompositeMultiReference', () => {
  it('erzeugt korrektes Frontmatter mit kind=composite-multi und _source_files', () => {
    const result = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [img('page_009.jpeg', 1), img('page_010.jpeg', 2), img('page_011.jpeg', 3)],
    })

    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.kind).toBe('composite-multi')
    expect(typeof meta.createdAt).toBe('string')

    const sourceFiles = parseCompositeSourceFilesFromMeta(meta)
    expect(sourceFiles).toEqual(['page_009.jpeg', 'page_010.jpeg', 'page_011.jpeg'])
  })

  it('liefert sourceFileNames in der Eingabe-Reihenfolge zurück', () => {
    const result = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [img('b.png', 1), img('a.png', 2), img('c.png', 3)],
    })

    // Reihenfolge MUSS erhalten bleiben — sie ist Teil des Secretary-Cache-Keys.
    expect(result.sourceFileNames).toEqual(['b.png', 'a.png', 'c.png'])
  })

  it('enthält die Quellen-Liste 1..N im Body', () => {
    const result = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [img('foo.jpg', 1), img('bar.jpg', 2)],
    })

    expect(result.markdown).toContain('1. [[foo.jpg]]')
    expect(result.markdown).toContain('2. [[bar.jpg]]')
  })

  it('enthält Obsidian-Embeds für jede Bilddatei', () => {
    const result = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [img('foo.jpg', 1), img('bar.jpg', 2)],
    })

    expect(result.markdown).toContain('![[foo.jpg]]')
    expect(result.markdown).toContain('![[bar.jpg]]')
  })

  it('verwendet den optionalen Titel als H1, sonst Default-Titel', () => {
    const withTitle = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [img('a.jpg', 1), img('b.jpg', 2)],
      title: 'CORTINA Steckbrief',
    })
    expect(withTitle.markdown).toContain('# CORTINA Steckbrief')

    const noTitle = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [img('a.jpg', 1), img('b.jpg', 2)],
    })
    expect(noTitle.markdown).toContain('# Bild-Sammelanalyse')
  })

  it('wirft, wenn weniger als 2 Quellen übergeben werden', () => {
    expect(() =>
      buildCompositeMultiReference({
        libraryId: 'lib-1',
        sourceItems: [img('only.jpg', 1)],
      })
    ).toThrow(/Mindestens 2 Bilder/i)
  })

  it('wirft, wenn keine Quelle übergeben wird', () => {
    expect(() =>
      buildCompositeMultiReference({
        libraryId: 'lib-1',
        sourceItems: [],
      })
    ).toThrow(/Mindestens 2 Bilder/i)
  })

  it('wirft, wenn mehr als COMPOSITE_MULTI_MAX_IMAGES Quellen übergeben werden', () => {
    const tooMany = Array.from({ length: COMPOSITE_MULTI_MAX_IMAGES + 1 }, (_, i) =>
      img(`p_${i}.jpeg`, i)
    )
    expect(() =>
      buildCompositeMultiReference({
        libraryId: 'lib-1',
        sourceItems: tooMany,
      })
    ).toThrow(/Maximal 10 Bilder/i)
  })

  it('erlaubt genau COMPOSITE_MULTI_MAX_IMAGES Quellen', () => {
    const exactly = Array.from({ length: COMPOSITE_MULTI_MAX_IMAGES }, (_, i) =>
      img(`p_${i}.jpeg`, i)
    )
    expect(() =>
      buildCompositeMultiReference({
        libraryId: 'lib-1',
        sourceItems: exactly,
      })
    ).not.toThrow()
  })

  it('wirft, wenn eine Nicht-Bild-Quelle dabei ist (kein silent skip)', () => {
    expect(() =>
      buildCompositeMultiReference({
        libraryId: 'lib-1',
        sourceItems: [img('bild.jpg', 1), img('audio.mp3', 2)],
      })
    ).toThrow(/Nur Bild-Quellen|audio\.mp3/i)
  })

  it('wirft mit allen Nicht-Bild-Dateinamen in der Fehlermeldung', () => {
    let err: Error | null = null
    try {
      buildCompositeMultiReference({
        libraryId: 'lib-1',
        sourceItems: [
          img('a.jpg', 1),
          img('doc.pdf', 2),
          img('clip.mp4', 3),
        ],
      })
    } catch (e) {
      err = e as Error
    }
    expect(err).not.toBeNull()
    expect(err?.message).toContain('doc.pdf')
    expect(err?.message).toContain('clip.mp4')
  })
})
