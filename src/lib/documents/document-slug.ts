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
