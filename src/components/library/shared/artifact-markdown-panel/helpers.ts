/**
 * shared/artifact-markdown-panel/helpers.ts
 *
 * Pure-Helper fuer ArtifactMarkdownPanel.
 *
 * Aus `shared/artifact-markdown-panel.tsx` ausgegliedert
 * (Welle 3-II-d, Schritt 3/7).
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'

/**
 * Erkennt, ob ein Markdown-Inhalt ein Composite-Container ist
 * (`kind: composite-transcript` oder `kind: composite-multi`).
 *
 * Solche Container haben spezielle Wikilink-/Embed-Syntax, die nur dann
 * korrekt gerendert wird, wenn `compositeWikiPreview` gesetzt ist.
 */
export function isCompositeContainerContent(content: string): boolean {
  if (!content?.trim()) return false
  const { meta } = parseFrontmatter(content)
  return meta?.kind === 'composite-transcript' || meta?.kind === 'composite-multi'
}

/**
 * Entfernt Frontmatter fuer reine Vorschau ohne Metadaten-Block.
 *
 * Bestands-Eigenheit: Die Regex `\\n?` am Ende konsumiert nur EIN
 * Newline nach den schliessenden `---`. Wenn der Body durch eine
 * Leerzeile getrennt ist, bleibt diese als fuehrende `\\n` erhalten.
 */
export function stripFrontmatterBlock(markdown: string): string {
  return markdown.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, '')
}
