/**
 * Prüft, ob eine URL sicher als iframe-src für eingebettete Web-Videos genutzt werden kann.
 *
 * Problem: Frontmatter-Felder wie `video_url` enthalten manchmal nur einen Dateinamen
 * (z. B. WhatsApp `.ogg`). Der Browser löst das relativ zur App-Origin auf → Next.js liefert
 * HTML (404-Seite) statt eines Players → Nutzer sieht die komplette Fehlerseite im iframe.
 */
export function isSafeVideoIframeSrc(raw: string): boolean {
  const u = raw.trim()
  if (!u) return false

  // Relative Pfade und nackte Dateinamen führen zu same-origin HTML — nie als Video-iframe.
  if (!/^https?:\/\//i.test(u)) return false

  try {
    const parsed = new URL(u)
    const host = parsed.hostname.toLowerCase()
    if (host.includes('youtube.com') || host === 'youtu.be') return true
    if (host.includes('vimeo.com')) return true
    // Direkte Video-Dateien (kein Audio — iframe ist dafür ungeeignet)
    if (/\.(mp4|webm)(\?|$)/i.test(parsed.pathname)) return true
    return false
  } catch {
    return false
  }
}
