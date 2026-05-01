// @vitest-environment node

/**
 * Characterization Tests fuer Pure-Helpers aus shared/artifact-markdown-panel.tsx
 * (Welle 3-II-d, Schritt 1).
 */

import { describe, it, expect } from 'vitest'
import { stripFrontmatterBlock, isCompositeContainerContent } from '@/components/library/shared/artifact-markdown-panel/helpers'

describe('stripFrontmatterBlock (artifact-markdown-panel) — Pure-Logik-Vertrag', () => {
  it('entfernt Frontmatter-Block am Anfang (eine \\n nach ---)', () => {
    // Bestands-Eigenheit: Die Regex \\n? am Ende konsumiert nur EIN
    // Newline nach den schliessenden ---. Wenn der Body durch eine
    // Leerzeile getrennt ist, bleibt diese als fuehrende \\n erhalten.
    const input = '---\ntitle: Hallo\n---\n\nBody-Inhalt'
    expect(stripFrontmatterBlock(input)).toBe('\nBody-Inhalt')
  })

  it('entfernt Frontmatter-Block direkt vor Body (kein Leerzeile)', () => {
    const input = '---\ntitle: Hallo\n---\nBody-Inhalt'
    expect(stripFrontmatterBlock(input)).toBe('Body-Inhalt')
  })

  it('akzeptiert Windows-Newlines (CRLF)', () => {
    const input = '---\r\ntitle: Hallo\r\n---\r\nBody'
    expect(stripFrontmatterBlock(input)).toBe('Body')
  })

  it('aendert nichts wenn kein Frontmatter vorhanden', () => {
    const input = '# Heading\n\nBody'
    expect(stripFrontmatterBlock(input)).toBe(input)
  })

  it('entfernt nur den ersten Frontmatter-Block', () => {
    const input = '---\nkey: a\n---\n\nBody\n---\nnested: b\n---'
    expect(stripFrontmatterBlock(input)).toContain('Body')
    expect(stripFrontmatterBlock(input)).toContain('nested: b')
  })

  it('akzeptiert leeres Frontmatter (---\\n---)', () => {
    const input = '---\n\n---\nBody'
    expect(stripFrontmatterBlock(input)).toBe('Body')
  })
})

describe('isCompositeContainerContent (artifact-markdown-panel) — Edge-Cases', () => {
  it('leerer Content liefert false', () => {
    expect(isCompositeContainerContent('')).toBe(false)
    expect(isCompositeContainerContent('   ')).toBe(false)
  })

  it('Markdown ohne kind-Frontmatter liefert false', () => {
    expect(isCompositeContainerContent('# Heading\n\nBody')).toBe(false)
    expect(isCompositeContainerContent('---\ntitle: X\n---\nBody')).toBe(false)
  })

  it('kind: composite-transcript liefert true', () => {
    const md = '---\nkind: composite-transcript\n---\n\nBody'
    expect(isCompositeContainerContent(md)).toBe(true)
  })

  it('kind: composite-multi liefert true', () => {
    const md = '---\nkind: composite-multi\n---\n\nBody'
    expect(isCompositeContainerContent(md)).toBe(true)
  })
})
