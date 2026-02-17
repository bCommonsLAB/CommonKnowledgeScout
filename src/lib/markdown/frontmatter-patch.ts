/**
 * @fileoverview Frontmatter-Patch-Utility
 *
 * @description
 * Ermöglicht das Patchen von Frontmatter-Werten ohne Quotes-Probleme.
 * Nutzt parseFrontmatter + createMarkdownWithFrontmatter (zentrale Serialisierung wie Job Worker).
 */

import { parseFrontmatter } from './frontmatter'
import { createMarkdownWithFrontmatter } from './compose'

/**
 * Patched Frontmatter-Werte in einem Markdown-Dokument.
 * Nutzt zentrale Serialisierung (compose) – mehrzeilige Strings werden via JSON.stringify
 * korrekt escaped (kein Bug bei Newlines).
 *
 * @param markdown Vollständiges Markdown mit Frontmatter
 * @param updates Zu aktualisierende Frontmatter-Felder
 * @returns Neues Markdown mit gepatchtem Frontmatter
 */
export function patchFrontmatter(markdown: string, updates: Record<string, unknown>): string {
  const { meta, body } = parseFrontmatter(markdown)
  const patchedMeta = { ...meta, ...updates }
  // Wie Original buildFrontmatter: undefined/null auslassen (nicht als "" ausgeben)
  const filtered = Object.fromEntries(
    Object.entries(patchedMeta).filter(([, v]) => v !== undefined && v !== null)
  )
  return createMarkdownWithFrontmatter(body, filtered)
}
