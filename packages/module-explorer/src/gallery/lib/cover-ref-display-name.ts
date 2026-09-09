/**
 * Anzeige-Name aus Frontmatter coverImageUrl / Thumbnail-URL:
 * letztes Pfadsegment (Azure-Blob-URL oder reiner Dateiname), Media-Lifecycle-konform.
 */
export function displayBasenameFromCoverRef(ref: string | undefined): string | undefined {
  if (!ref?.trim()) return undefined
  const t = ref.trim()
  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const pathname = new URL(t).pathname
      const last = pathname.split('/').filter(Boolean).pop()
      return last ? decodeURIComponent(last) : undefined
    } catch {
      return undefined
    }
  }
  const norm = t.replace(/\\/g, '/')
  const parts = norm.split('/').filter(Boolean)
  const last = parts.length ? parts[parts.length - 1] : undefined
  return last || undefined
}
