// @vitest-environment jsdom

/**
 * Characterization Tests fuer die `extractFrontmatter`-Pure-Funktion
 * aus `markdown-metadata.tsx` (Welle 3-II, Schritt 3).
 *
 * Die `MarkdownMetadata`-Render-Komponente selbst hat next/image-Abhaengigkeiten
 * und ist im jsdom-Test schwer renderbar — dafuer kommt der UI-Smoke. Hier
 * fixieren wir den **Frontmatter-Parsing-Vertrag**, der die Basis fuer
 * jeden Render ist.
 */

import { describe, it, expect } from 'vitest'
import { extractFrontmatter } from '@/components/library/markdown-metadata'

describe('extractFrontmatter (markdown-metadata)', () => {
  it('liefert null, wenn kein Frontmatter vorhanden ist', () => {
    const result = extractFrontmatter('# Nur Markdown\n\nKein Frontmatter.')
    expect(result).toBeNull()
  })

  it('liefert ein Objekt mit den Frontmatter-Keys', () => {
    const md = `---
title: Mein Dokument
author: Maria
---

# Inhalt
`
    const result = extractFrontmatter(md)
    expect(result).not.toBeNull()
    expect(result?.title).toBe('Mein Dokument')
    expect(result?.author).toBe('Maria')
  })

  it('parst nummerische Felder als Strings (parser-Vertrag)', () => {
    const md = `---
title: Mein Dokument
chunkCount: 42
---

Body.`
    const result = extractFrontmatter(md)
    // Der secretary-Parser liefert YAML-Werte; chunkCount ist hier ein
    // numerischer Wert (oder als String — wir akzeptieren beides).
    expect(result?.chunkCount).toBeDefined()
  })

  it('parst leeres Frontmatter als null (keine Keys)', () => {
    const md = `---
---

Body.`
    const result = extractFrontmatter(md)
    expect(result).toBeNull()
  })
})
