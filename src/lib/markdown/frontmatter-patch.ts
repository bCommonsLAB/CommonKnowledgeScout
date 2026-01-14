/**
 * @fileoverview Frontmatter-Patch-Utility
 *
 * @description
 * Ermöglicht das Patchen von Frontmatter-Werten ohne Quotes-Probleme.
 * Nutzt parseFrontmatter + rebuild für saubere YAML-Syntax.
 */

import { parseFrontmatter } from './frontmatter'

/**
 * Erstellt Frontmatter aus Metadaten (ohne Quotes-Probleme).
 * Nutzt YAML-konforme Formatierung.
 */
function buildFrontmatter(metadata: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue
    
    if (typeof value === 'string') {
      // Nur Quotes hinzufügen, wenn der String Leerzeichen, Sonderzeichen oder mehrzeilig ist
      const needsQuotes = value.includes(' ') || value.includes(':') || value.includes('\n') || value.includes("'") || value.includes('"')
      if (needsQuotes) {
        // Escape doppelte Anführungszeichen
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
      } else {
        lines.push(`${key}: ${value}`)
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  return `---\n${lines.join('\n')}\n---`
}

/**
 * Patched Frontmatter-Werte in einem Markdown-Dokument.
 * 
 * @param markdown Vollständiges Markdown mit Frontmatter
 * @param updates Zu aktualisierende Frontmatter-Felder
 * @returns Neues Markdown mit gepatchtem Frontmatter
 */
export function patchFrontmatter(markdown: string, updates: Record<string, unknown>): string {
  const { meta, body } = parseFrontmatter(markdown)
  
  // Merge Updates in bestehende Metadaten
  const patchedMeta = { ...meta, ...updates }
  
  // Baue neues Frontmatter
  const newFrontmatter = buildFrontmatter(patchedMeta)
  
  // Kombiniere Frontmatter + Body
  return `${newFrontmatter}\n${body}`
}
