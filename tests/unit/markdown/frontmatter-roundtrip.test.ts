import { describe, it, expect } from 'vitest'
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

/**
 * Regressions-Guard gegen die "Quote-Ueber-Maskierung":
 * Serializer (compose, JSON.stringify) und Parser (parseFrontmatter, JSON.parse) muessen
 * SYMMETRISCH sein, damit ein Re-Save IDEMPOTENT ist. Frueher re-serialisierte
 * storage.ts Frontmatter manuell mit `value.replace(/"/g, '\\"')` (escapte keine
 * Backslashes, asymmetrisch) -> bei jedem Lauf kam eine `\`-Ebene dazu.
 */
describe('frontmatter compose/parse roundtrip (Quote-Ueber-Maskierung)', () => {
  it('dekodiert Anfuehrungszeichen korrekt und bleibt ueber zwei Laeufe identisch', () => {
    const meta = { title: 'ABOUT THE "HUMANIZATION OF MONEY" Basic Principles', detailViewType: 'book' }

    const md1 = createMarkdownWithFrontmatter('Body-Text.', meta)
    const parsed1 = parseFrontmatter(md1)
    // Parser muss den Wert vollstaendig dekodieren (keine \" Reste)
    expect(parsed1.meta.title).toBe(meta.title)

    // Zweite Runde MUSS identisch sein (keine zusaetzliche Escaping-Ebene)
    const md2 = createMarkdownWithFrontmatter(parsed1.body, parsed1.meta)
    expect(md2).toBe(md1)
    expect(parseFrontmatter(md2).meta.title).toBe(meta.title)
  })

  it('ist idempotent fuer Werte mit Backslash UND Quote (der Akkumulations-Fall)', () => {
    const meta = { title: 'Pfad C:\\temp und "Zitat"' }

    const md1 = createMarkdownWithFrontmatter('Body.', meta)
    const parsed1 = parseFrontmatter(md1)
    expect(parsed1.meta.title).toBe(meta.title)

    const md2 = createMarkdownWithFrontmatter(parsed1.body, parsed1.meta)
    expect(md2).toBe(md1)
    expect(parseFrontmatter(md2).meta.title).toBe(meta.title)
  })

  it('akkumuliert ueber DREI Laeufe keine zusaetzlichen Backslashes', () => {
    const meta = { title: 'Er sagte "Hallo" zu \\allen\\' }

    let md = createMarkdownWithFrontmatter('Body.', meta)
    for (let i = 0; i < 3; i++) {
      const parsed = parseFrontmatter(md)
      expect(parsed.meta.title).toBe(meta.title) // bleibt unveraendert, keine \-Ebene mehr
      md = createMarkdownWithFrontmatter(parsed.body, parsed.meta)
    }
  })
})
