/**
 * Client-seitige Auflösung von Galerie-Cover-Referenzen.
 *
 * Frontmatter/Media-Lifecycle speichert oft nur Dateinamen (keine URLs).
 * CSS `background-image: url("nur-dateiname.jpg")` ist im Browser ungültig —
 * daher Auflösung über dieselben API-Endpunkte wie die Job-Vorschau.
 */

import { parseTwinRelativeImageRef } from '@/lib/storage/shadow-twin-folder-name'

/** true, wenn die Referenz nicht direkt als Bild-URL verwendet werden kann */
export function coverRefNeedsApiResolution(ref: string): boolean {
  const u = ref.trim()
  if (!u) return false
  if (u.startsWith('http://') || u.startsWith('https://')) return false
  if (u.startsWith('/api/storage/streaming-url')) return false
  if (u.startsWith('data:')) return false
  return true
}

/**
 * Dateiname für Geschwister-Match im Elternordner der Quelldatei.
 * Bei Shadow-Twin-Pfaden (`_Quelle.pdf/fragment.jpeg`) null — dort nur resolve-binary-url.
 */
export function leafFileNameForSiblingMatch(coverRef: string): string | null {
  if (parseTwinRelativeImageRef(coverRef)) return null
  const normalized = coverRef.trim().replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  const leaf = parts.length > 0 ? parts[parts.length - 1]! : ''
  return leaf.length > 0 ? leaf : null
}

export interface ResolveCoverUrlViaApiOptions {
  libraryId: string
  /** Storage-Datei-ID des Galerie-Dokuments (z. B. Markdown im Twin-Ordner) */
  fileId: string
  /** Rohwert aus coverThumbnailUrl / coverImageUrl */
  coverRef: string
  /** Hilft dem Server-Fallback (Mongo Shadow-Twin → Storage) */
  sourceFileName?: string
}

/**
 * Liefert eine für `<img>` / CSS `url()` nutzbare URL oder null.
 * Reihenfolge: resolve-binary-url (Mongo + Storage-Fallbacks), dann Geschwister im selben Ordner.
 */
export async function resolveCoverUrlViaApi(options: ResolveCoverUrlViaApiOptions): Promise<string | null> {
  const { libraryId, fileId, coverRef, sourceFileName } = options
  const fragmentName = coverRef.trim()
  if (!fragmentName) return null

  try {
    const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/resolve-binary-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: fileId,
        sourceName: sourceFileName || '',
        parentId: '',
        fragmentName,
      }),
    })
    if (res.ok) {
      const json = (await res.json()) as { resolvedUrl?: string }
      if (json.resolvedUrl) return json.resolvedUrl
    }
  } catch {
    // absichtlich: zweiter Versuch sibling-files
  }

  const leaf = leafFileNameForSiblingMatch(fragmentName)
  if (!leaf) return null

  try {
    const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/sibling-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: fileId }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { files?: Array<{ id: string; name: string }> }
    const match = json.files?.find((f) => f.name.toLowerCase() === leaf.toLowerCase())
    if (match) {
      return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(match.id)}`
    }
  } catch {
    return null
  }
  return null
}
