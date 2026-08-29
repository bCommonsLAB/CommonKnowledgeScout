/**
 * @fileoverview Dokument-Slug für das PERSISTIEREN (`meta.slug`).
 *
 * Dies ist die MASSGEBLICHE Slug-Regel des Repos: ihr Ergebnis wird dauerhaft
 * geschrieben (MongoDB `item.meta.slug`, Frontmatter, Ziel-Dateiname bei der
 * Publikation). Die Navigationsseite
 * (`@/utils/document-slug-navigation`) leitet ihren `?doc=`-Slug von hier ab
 * und slugifiziert NICHT selbst — sie ergänzt nur Längenbegrenzung und
 * Kollisions-Suffix. Wer die Regel ändert, ändert sie hier; die
 * Navigationsseite zieht dann automatisch nach.
 *
 * Kandidaten-Reihenfolge: Aufrufer geben sie vor. Für Dokument-Karten gilt
 * Dateiname zuerst — `ingestion-service` (fileName → source_file → title),
 * `phase-template` (Artefaktname → Quellname → title) und die Navigation
 * halten sich daran, damit dasselbe Dokument beidseitig denselben Slug ergibt.
 *
 * @module lib/documents/document-slug-persist
 */

/**
 * Erzeugt einen stabilen Dokument-Slug aus einem Dateinamen oder anderen Kandidaten.
 * Für Transformations-Artefakte bevorzugen wir den Artefaktnamen, damit mehrere
 * Templates derselben Quelle nicht denselben Slug teilen.
 */
export function buildDocumentSlugFallback(...candidates: Array<string | undefined | null>): string {
  const picked = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || 'document'

  // Nur die letzte Extension entfernen (.md, .json, ...). Template-/Sprachsuffixe bleiben bewusst erhalten.
  const withoutLastExt = picked.replace(/\.[^.]+$/g, '')

  let slug = withoutLastExt
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase()

  if (!slug) slug = 'document'
  if (/^[0-9]/.test(slug)) slug = `doc-${slug}`
  return slug
}
