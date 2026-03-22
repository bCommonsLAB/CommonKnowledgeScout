/**
 * @fileoverview Einheitliche Suche nach Binary-Fragmenten, wenn der gesuchte Name
 * vom kanonischen Vault-Dateinamen abweicht (z. B. Transkript nutzt `hash.jpeg`, Storage `img-1.jpeg`).
 */

const IMAGE_EXTS = ['jpeg', 'jpg', 'png', 'gif', 'webp'] as const

export type BinaryFragmentLookupFields = {
  name: string
  hash?: string
  originalName?: string
  mimeType?: string
  /** Azure- o. ä. URL — Blob-Dateiname entspricht oft dem Hash-Namen im alten Transkript */
  url?: string
}

function blobNameLowerFromUrl(url: string): string {
  const tail = url.split('/').pop() || url
  return tail.split('?')[0].toLowerCase()
}

/**
 * Findet ein Fragment, wenn der Lookup-Name einer der üblichen Alias-Formen ist:
 * - kanonischer `name` (z. B. img-0.jpeg)
 * - `originalName` (Mongo/Azure-Mapping)
 * - letztes URL-Segment von `url` (häufig: `…/326c3b8….jpeg` im Transkript, `name` = img-0.jpeg)
 * - `{hash}.jpeg` / `{hash}.jpg` / … (Mongo `hash`-Feld)
 */
export function matchBinaryFragmentByLookupName<T extends BinaryFragmentLookupFields>(
  fragments: T[] | null | undefined,
  lookupRaw: string,
): T | null {
  if (!fragments?.length || !lookupRaw?.trim()) return null
  const lookup = lookupRaw.trim().toLowerCase()

  const byName = fragments.find(f => f.name.toLowerCase() === lookup)
  if (byName) return byName

  const byOriginal = fragments.find(f => f.originalName?.toLowerCase() === lookup)
  if (byOriginal) return byOriginal

  for (const f of fragments) {
    if (f.url) {
      const bn = blobNameLowerFromUrl(f.url)
      if (bn && bn === lookup) return f
    }
  }

  for (const f of fragments) {
    if (!f.hash) continue
    for (const ext of IMAGE_EXTS) {
      const e = ext === 'jpg' ? 'jpeg' : ext
      if (`${f.hash}.${e}`.toLowerCase() === lookup) return f
    }
  }

  return null
}
