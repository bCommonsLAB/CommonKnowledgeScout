/**
 * Kürzt einen String auf maximale Länge.
 */
export function safeText(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}

/**
 * Erstellt eine Hash-ID aus einem String (für Kapitel-IDs etc.).
 */
export function hashId(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}






