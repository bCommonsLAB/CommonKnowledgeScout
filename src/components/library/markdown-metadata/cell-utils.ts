/**
 * markdown-metadata/cell-utils.ts
 *
 * Pure Helper-Funktionen fuer die Tabellendarstellung in MarkdownMetadata.
 *
 * Aus `markdown-metadata.tsx` ausgegliedert (Welle 3-II-b, Schritt 6/8).
 *
 * Keine React-Hooks, kein DOM-Zugriff. Reine Daten-Transformationen.
 */

/** Type-Guard: ist Wert ein Plain-Object (kein Array, kein null)? */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Kuerzt einen String auf eine maximale Laenge. */
export function truncate(value: string, max = 160): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** Konvertiert einen Wert in einen String fuer die Anzeige. */
export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Datentyp einer Zelle fuer die Tabellen-Formatierung. */
export type CellType = 'empty' | 'number' | 'boolean' | 'url' | 'image' | 'text'

/** Bestimmt den Datentyp einer Zelle fuer bessere Formatierung. */
export function getCellType(value: unknown): CellType {
  if (value === null || value === undefined || value === '') return 'empty'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) return 'url'
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(value)) return 'image'
    return 'text'
  }
  return 'text'
}

/**
 * Ermittelt dynamisch alle Spalten eines Objekt-Arrays und sortiert sie:
 * 1. Numerische Spalten (page_num, page, index, id, ...) zuerst
 * 2. Semantisch wichtige Spalten (title, name, summary, ...)
 * 3. Nach Haeufigkeit (haeufigere zuerst)
 * 4. Alphabetisch
 */
export function extractAndSortColumns(objects: Record<string, unknown>[]): string[] {
  const keySet = new Set<string>()
  const keyFrequency = new Map<string, number>()

  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      keySet.add(key)
      keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1)
    }
  }

  const keys = Array.from(keySet)

  const numericPattern = /^(page|num|index|id|order|rank|position|seq)/i
  const semanticPattern = /^(title|name|label|summary|description|text|content|value|url|image|link|source|target|key|type|status|state|category|tag)/i

  keys.sort((a, b) => {
    const aHasNumeric = numericPattern.test(a)
    const bHasNumeric = numericPattern.test(b)
    const aHasSemantic = semanticPattern.test(a)
    const bHasSemantic = semanticPattern.test(b)
    const aFreq = keyFrequency.get(a) || 0
    const bFreq = keyFrequency.get(b) || 0

    if (aHasNumeric && !bHasNumeric) return -1
    if (!aHasNumeric && bHasNumeric) return 1

    if (aHasSemantic && !bHasSemantic) return -1
    if (!aHasSemantic && bHasSemantic) return 1

    if (aFreq !== bFreq) return bFreq - aFreq

    return a.localeCompare(b)
  })

  return keys
}

/** Versucht einen Wert als JSON-Array/-Objekt zu parsen, falls er ein String ist. */
export function tryParseJsonArray(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return JSON.parse(trimmed)
      } catch {
        // Nicht parsen, falls Fehler — Original-String behalten.
      }
    }
  }
  return value
}

/**
 * Konvertiert einen relativen Pfad (bezogen auf Library-Root) zu einer
 * Storage-API-URL. Der relative Pfad wird base64-kodiert und als fileId
 * verwendet.
 *
 * @param relativePath Relativer Pfad wie "2024 SFSCON/assets/preview.jpg"
 * @param libraryId Die Library-ID
 * @returns Storage-API-URL oder undefined falls libraryId fehlt
 */
export function resolveImageUrl(
  relativePath: string | undefined,
  libraryId: string | undefined,
): string | undefined {
  if (!relativePath || !libraryId) {
    return relativePath
  }

  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath
  }

  const normalizedPath = relativePath.replace(/^\/+|\/+$/g, '')

  if (normalizedPath.includes('..')) {
    console.warn('[markdown-metadata/cell-utils] Path traversal detected, ignoring:', normalizedPath)
    return relativePath
  }

  try {
    const utf8Bytes = new TextEncoder().encode(normalizedPath)
    let binary = ''
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i])
    }
    const fileId = btoa(binary)
    return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
  } catch (error) {
    console.error('[markdown-metadata/cell-utils] Fehler beim Konvertieren des Bildpfads:', error)
    return relativePath
  }
}
