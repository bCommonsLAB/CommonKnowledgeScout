/**
 * @fileoverview Embed-Adresse eines Videos aus Seitenadresse oder Seiten-Medien ableiten.
 *
 * @description
 * Die Ereignis-Ansicht bettet `video_url` nur als fertige Embed-Adresse ein
 * (`isSafeVideoIframeSrc` in @ks/util: YouTube, Vimeo, PeerTube `/videos/embed/`).
 * Eine YouTube-„watch"-Adresse oder eine Vimeo-Seitenadresse spielt im iframe
 * nicht. Deshalb hier die Umwandlung — nur fuer Anbieter, die der Player
 * kennt; alles andere ergibt null (kein geratenes Embed).
 *
 * @module web-source
 */

import type { WebPageMedia } from './page-extract'

function youtubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase()
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  if (host.endsWith('youtube.com')) {
    if (u.pathname === '/watch') return u.searchParams.get('v')
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/)
    return m ? m[1] : null
  }
  return null
}

/** Wandelt eine bekannte Video-Seitenadresse in die Embed-Adresse um; sonst null. */
export function embedUrlAusAdresse(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase()
  const yt = youtubeId(u)
  if (yt) return `https://www.youtube.com/embed/${yt}`
  if (host.endsWith('vimeo.com')) {
    const m = u.pathname.match(/\/(?:video\/)?(\d{5,})/)
    return m ? `https://player.vimeo.com/video/${m[1]}` : null
  }
  // PeerTube: /w/<id> oder /videos/watch/<id> → /videos/embed/<id>; Embed bleibt Embed.
  const pt = u.pathname.match(/^\/(?:w|videos\/watch|videos\/embed)\/([A-Za-z0-9_-]{8,})/)
  if (pt) return `${u.origin}/videos/embed/${pt[1]}`
  return null
}

/** Embed-Adresse fuer eine Seite: zuerst die Seite selbst (YouTube/Vimeo/PeerTube-Seite), sonst ein Embed aus den Seiten-Medien. */
export function embedUrlFuerVideo(pageUrl: string, media: ReadonlyArray<WebPageMedia>): string | null {
  const eigene = embedUrlAusAdresse(pageUrl)
  if (eigene) return eigene
  for (const m of media) {
    if (m.art !== 'embed') continue
    const e = embedUrlAusAdresse(m.url)
    if (e) return e
  }
  return null
}
