/**
 * Prüft, ob ein Dateiname zu einem einfachen Shell-Muster passt.
 * Nur `*` als Platzhalter (beliebige Teilzeichenkette), vergleich case-insensitive.
 * Leeres oder nur-Leerzeichen-Muster = alles passt.
 */
export function matchesGlobFileName(fileName: string, pattern: string): boolean {
  const p = pattern.trim()
  if (!p) return true
  const parts = p.split('*').map((seg) => seg.replace(/[\\^$+?.()|[\]{}]/g, '\\$&'))
  const body = parts.join('.*')
  try {
    return new RegExp(`^${body}$`, 'i').test(fileName)
  } catch {
    return false
  }
}
