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
    // PeerTube-Embed (instanzunabhaengig, z. B. peertube.uno): /videos/embed/<id>
    if (/\/videos\/embed\//.test(parsed.pathname)) return true
    // Direkte Video-Dateien (kein Audio — iframe ist dafür ungeeignet)
    if (/\.(mp4|webm)(\?|$)/i.test(parsed.pathname)) return true
    return false
  } catch {
    return false
  }
}

/**
 * Prüft, ob eine URL als iframe-src für einen eingebetteten Audio-Player taugt.
 * Erlaubt: Funkwhale/open.audio-Embed (`/embed.html?type=track…`). Direkte Audio-
 * Dateien gehören in ein `<audio>`-Element, siehe `isDirectAudioFileUrl`.
 */
export function isSafeAudioIframeSrc(raw: string): boolean {
  const u = raw.trim()
  if (!u || !/^https?:\/\//i.test(u)) return false
  try {
    const parsed = new URL(u)
    // Funkwhale-Embed (instanzunabhaengig, z. B. open.audio): /embed.html?type=track&id=…
    if (/\/embed\.html$/.test(parsed.pathname) && parsed.searchParams.has('type')) return true
    return false
  } catch {
    return false
  }
}

/** Direkte Audio-Datei (mp3, ogg, m4a, wav, opus, flac) über http(s). */
export function isDirectAudioFileUrl(raw: string): boolean {
  const u = raw.trim()
  if (!u || !/^https?:\/\//i.test(u)) return false
  try {
    return /\.(mp3|ogg|m4a|wav|opus|flac)(\?|$)/i.test(new URL(u).pathname)
  } catch {
    return false
  }
}
