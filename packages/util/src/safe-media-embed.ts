/**
 * Guards fuer eingebettete Medien-Player (Video/Audio als iframe oder <audio>).
 *
 * Problem: Frontmatter-Felder wie `video_url`/`audio_url` enthalten manchmal nur einen
 * Dateinamen (z. B. WhatsApp `.ogg`). Der Browser loest das relativ zur App-Origin auf,
 * Next liefert HTML (404-Seite) statt eines Players, und der Nutzer sieht die komplette
 * Fehlerseite im iframe. Deshalb kommen nur bekannte Embed-Formen und direkte
 * Mediendateien ueber http(s) durch.
 *
 * Liegt im Paket, weil die Buch-Ansicht (`@ks/module-explorer`, auch im Embed) und die
 * Ereignis-Ansicht der App dieselben Regeln brauchen; die App re-exportiert sie.
 */

function parseHttpUrl(raw: string): URL | null {
  const u = raw.trim()
  if (!u) return null
  // Relative Pfade und nackte Dateinamen fuehren zu same-origin HTML — nie einbetten.
  if (!/^https?:\/\//i.test(u)) return null
  try {
    return new URL(u)
  } catch {
    return null
  }
}

/** Sichere iframe-src fuer Web-Videos: YouTube, Vimeo, PeerTube-Embed, direkte mp4/webm. */
export function isSafeVideoIframeSrc(raw: string): boolean {
  const parsed = parseHttpUrl(raw)
  if (!parsed) return false
  const host = parsed.hostname.toLowerCase()
  if (host.includes('youtube.com') || host === 'youtu.be') return true
  if (host.includes('vimeo.com')) return true
  // PeerTube-Embed (instanzunabhaengig, z. B. peertube.uno): /videos/embed/<id>
  if (/\/videos\/embed\//.test(parsed.pathname)) return true
  // Direkte Video-Dateien (kein Audio — iframe ist dafuer ungeeignet)
  if (/\.(mp4|webm)(\?|$)/i.test(parsed.pathname)) return true
  return false
}

/**
 * Sichere iframe-src fuer einen eingebetteten Audio-Player: Funkwhale/open.audio-Embed
 * (`/embed.html?type=track…`). Direkte Audio-Dateien gehoeren in ein `<audio>`-Element,
 * siehe `isDirectAudioFileUrl`.
 */
export function isSafeAudioIframeSrc(raw: string): boolean {
  const parsed = parseHttpUrl(raw)
  if (!parsed) return false
  return /\/embed\.html$/.test(parsed.pathname) && parsed.searchParams.has('type')
}

/** Direkte Audio-Datei (mp3, ogg, m4a, wav, opus, flac) ueber http(s). */
export function isDirectAudioFileUrl(raw: string): boolean {
  const parsed = parseHttpUrl(raw)
  if (!parsed) return false
  return /\.(mp3|ogg|m4a|wav|opus|flac)(\?|$)/i.test(parsed.pathname)
}
