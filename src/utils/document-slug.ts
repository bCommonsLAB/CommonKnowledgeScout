import type { DocCardMeta } from '@/lib/gallery/types'
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug'

/**
 * Stabiler kurzer Suffix aus fileId (FNV-1a-ähnlich), damit synthetische Slugs
 * bei gleichem Titel/Dateinamen nicht kollidieren.
 */
function shortStableSuffix(fileId: string): string {
  let h = 2166136261
  for (let i = 0; i < fileId.length; i++) {
    h ^= fileId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = h >>> 0
  return n.toString(36).slice(0, 8)
}

function truncateSlugMiddle(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).replace(/-+$/g, '')
}

/**
 * Slug für den `doc`-Query-Parameter (auf Basis der gleichen Regeln wie
 * `buildDocumentSlugFallback`, Länge begrenzt).
 */
export function slugifyForDocumentUrl(input: string, maxLen = 80): string {
  return truncateSlugMiddle(buildDocumentSlugFallback(input), maxLen)
}

/**
 * Effektiver Slug für Gallery-Navigation (`?doc=…`):
 * - Wenn in den Metadaten ein Slug gesetzt ist: diesen verwenden (Backwards-kompatibel).
 * - Sonst aus Titel / Kurztitel / Dateiname ableiten + kurzer eindeutiger Suffix aus fileId,
 *   damit alte Archive ohne `meta.slug` trotzdem eindeutig adressierbar sind.
 *
 * @returns `null` nur wenn weder fileId noch id vorhanden sind
 */
export function getEffectiveDocumentNavigationSlug(doc: DocCardMeta): string | null {
  const fid = doc.fileId || doc.id
  if (!fid) return null

  const persisted = typeof doc.slug === 'string' ? doc.slug.trim() : ''
  if (persisted.length > 0) return persisted

  const base = truncateSlugMiddle(
    buildDocumentSlugFallback(doc.title, doc.shortTitle, doc.fileName),
    80
  )
  return `${base}-${shortStableSuffix(fid)}`
}

/**
 * Prüft, ob `docSlug` aus der URL zu diesem Dokument gehört (persistierter oder synthetischer Slug).
 */
export function docMatchesNavigationSlug(doc: DocCardMeta, docSlug: string): boolean {
  if (!docSlug) return false
  const effective = getEffectiveDocumentNavigationSlug(doc)
  if (effective === docSlug) return true
  const persisted = typeof doc.slug === 'string' ? doc.slug.trim() : ''
  return persisted.length > 0 && persisted === docSlug
}
