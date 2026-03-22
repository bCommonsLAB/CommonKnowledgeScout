/**
 * @fileoverview Bewusste Weitergabe von Quell-Metadaten in transformierte Dateien.
 *
 * Die Template-Phase darf nicht blind das gesamte Transcript-Frontmatter übernehmen,
 * weil Felder wie `kind: composite-transcript` nur für die Referenzdatei gelten.
 * Für Mehrquellen-Transformationen müssen aber `_source_files` erhalten bleiben,
 * damit Medienaggregation und spätere Auflösung dieselben Quellen rekonstruieren können.
 */

/**
 * Nur stabile Quell-Metadaten aus dem Transcript-Frontmatter weiterreichen.
 * Aktuell ist das bewusst nur `_source_files`.
 */
export function extractForwardedTemplateSourceFrontmatter(
  meta?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!meta) return {}

  const raw = meta._source_files
  if (Array.isArray(raw) && raw.length > 0) {
    return { _source_files: raw }
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          _source_files: parsed.filter((v): v is string => typeof v === 'string'),
        }
      }
    } catch {
      try {
        const normalized = raw
          .trim()
          .replace(/\\"/g, '"')
          .replace(/^"(.*)"$/s, '$1')
        const reparsed = JSON.parse(normalized)
        if (Array.isArray(reparsed) && reparsed.length > 0) {
          return {
            _source_files: reparsed.filter((v): v is string => typeof v === 'string'),
          }
        }
      } catch {
        // Ungültiges Altformat nicht weiterreichen
      }
    }
  }

  return {}
}
