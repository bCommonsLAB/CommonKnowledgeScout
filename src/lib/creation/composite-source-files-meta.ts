/**
 * @fileoverview Client- und server-sicheres Parsen von `_source_files` im Composite-Frontmatter.
 *
 * Liegt bewusst getrennt von `composite-transcript.ts`, damit UI-Module nicht die
 * schweren Server-Imports (Mongo, Storage) des Composite-Builders ziehen.
 */

/** Parst `_source_files` aus einem Frontmatter-Meta-Objekt (wie in `resolveCompositeTranscript`). */
export function parseCompositeSourceFilesFromMeta(meta: Record<string, unknown>): string[] {
  const raw = meta['_source_files']
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string')
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      // Altformat: YAML-String mit escaped JSON, z. B. "[\"a.pdf\",\"b.pdf\"]"
      try {
        const normalized = raw
          .trim()
          .replace(/\\"/g, '"')
          .replace(/^"(.*)"$/s, '$1')
        const reparsed = JSON.parse(normalized)
        if (Array.isArray(reparsed)) {
          return reparsed.filter((v): v is string => typeof v === 'string')
        }
      } catch {
        // Kein gültiges JSON-Array
      }
    }
  }
  return []
}
