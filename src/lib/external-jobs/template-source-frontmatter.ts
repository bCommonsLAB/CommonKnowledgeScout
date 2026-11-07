/**
 * @fileoverview Bewusste Weitergabe von Quell-Metadaten in transformierte Dateien.
 *
 * Die Template-Phase darf nicht blind das gesamte Transcript-Frontmatter übernehmen,
 * weil Felder wie `kind: composite-transcript` nur für die Referenzdatei gelten.
 * Für Mehrquellen-Transformationen müssen aber `_source_files` erhalten bleiben,
 * damit Medienaggregation und spätere Auflösung dieselben Quellen rekonstruieren können.
 *
 * Seit 07.11.2026 ebenso `_media_files`: Der Ingest nimmt daraus den Eintrag mit
 * Cover-Namen als Ersatzweg, wenn das Modell `coverImageUrl` leer lässt
 * (`src/lib/ingestion/cover-aus-medienliste.ts`).
 */

/** Namen der Quell-Felder, die in den Twin wandern. */
const WEITERGEREICHTE_LISTEN = ['_source_files', '_media_files'] as const

/**
 * Liste aus Array, JSON-Text oder doppelt serialisiertem YAML-String —
 * null, wenn kein nichtleeres Array lesbar ist.
 */
function listeAusWert(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw.filter((v): v is string => typeof v === 'string') : null
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((v): v is string => typeof v === 'string')
    }
  } catch {
    try {
      const normalized = raw
        .trim()
        .replace(/\\"/g, '"')
        .replace(/^"(.*)"$/s, '$1')
      const reparsed: unknown = JSON.parse(normalized)
      if (Array.isArray(reparsed) && reparsed.length > 0) {
        return reparsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      // Ungültiges Altformat nicht weiterreichen
    }
  }
  return null
}

/**
 * Nur stabile Quell-Metadaten aus dem Transcript-Frontmatter weiterreichen:
 * `_source_files` und `_media_files`, jeweils als Liste.
 */
export function extractForwardedTemplateSourceFrontmatter(
  meta?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!meta) return {}
  const out: Record<string, unknown> = {}
  for (const feld of WEITERGEREICHTE_LISTEN) {
    const liste = listeAusWert(meta[feld])
    if (liste) out[feld] = liste
  }
  return out
}
