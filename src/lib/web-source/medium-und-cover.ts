/**
 * @fileoverview Medium und Cover einer Webseite laden (aus `webseite-erschliessen.ts` ausgelagert).
 *
 * @description
 * Medium: Direkte AUDIO-Datei (http/https) laedt KnowledgeScout selbst; Streams
 * (HLS/DASH) und Videos laedt der Secretary und zieht nur die Tonspur heraus
 * (m4a) — gebraucht wird die Transkription, und Audio-Optionen gelten nur fuer
 * Audio (Befund Cowork-Test 13.10.). Scheitert yt-dlp, bleibt die von der
 * Seite genannte Adresse als dritter Weg. Jeder Ausfall endet mit Grund.
 * Cover: das Bild, das Seite oder yt-dlp nennen (JPEG/PNG/WebP).
 *
 * @module web-source
 */

import { downloadDeclaredMedia, downloadMedia, downloadMediaViaSecretary, type DownloadedMedia, type ResolvedMedia } from './media-resolve'
import type { WebPageExtract } from './page-extract'
import { PAGE_USER_AGENT } from './seite-laden'
import { sichererAbruf } from './sicherer-abruf'

export { PAGE_USER_AGENT } from './seite-laden'

/** Obergrenze fuer ein Coverbild. */
const MAX_COVER_BYTES = 20 * 1024 * 1024

export type MediumWeg = 'secretary' | 'secretary-download' | 'seite'

export type MediumErgebnis = { datei: DownloadedMedia; dauer: number | null; weg: MediumWeg } | { grund: string }

export type CoverErgebnis = { buffer: Buffer; ext: string; mimeType: string } | { grund: string }

/** Laedt das Medium; `resolved` ist das Ergebnis von media/resolve oder dessen Fehler. */
export async function holeMedium(seite: WebPageExtract, resolved: ResolvedMedia | { fehler: string }, cookies: string | null = null): Promise<MediumErgebnis> {
  let secretaryFehler: string
  if ('fehler' in resolved) {
    secretaryFehler = resolved.fehler
  } else {
    try {
      if (/^https?$/i.test(resolved.protocol) && resolved.istAudio) {
        const datei = await downloadMedia(resolved.directUrl, { ext: resolved.ext, istAudio: resolved.istAudio, httpHeaders: resolved.httpHeaders })
        return { datei, dauer: resolved.duration, weg: 'secretary' }
      }
      const geladen = await downloadMediaViaSecretary(seite.url, undefined, cookies)
      return { datei: { buffer: geladen.buffer, mimeType: geladen.mimeType, ext: geladen.ext }, dauer: geladen.duration ?? resolved.duration, weg: 'secretary-download' }
    } catch (error) {
      secretaryFehler = error instanceof Error ? error.message : String(error)
    }
  }
  const direkt = seite.media.find((m) => m.art === 'audio' || m.art === 'video')
  if (!direkt) return { grund: `yt-dlp: ${secretaryFehler}; die Seite nennt keine direkte Audio-/Video-Adresse` }
  try {
    const datei = await downloadDeclaredMedia(direkt.url, seite.url)
    return { datei, dauer: null, weg: 'seite' }
  } catch (error) {
    const seitenFehler = error instanceof Error ? error.message : String(error)
    return { grund: `yt-dlp: ${secretaryFehler}; Adresse der Seite (${direkt.herkunft}): ${seitenFehler}` }
  }
}

/** Laedt das Coverbild; ohne Adresse oder bei fremdem Format steht der Grund im Ergebnis. */
export async function holeCover(imageUrl: string, pageUrl: string): Promise<CoverErgebnis> {
  if (!imageUrl) return { grund: 'Seite nennt kein Bild (og:image/JSON-LD/Thumbnail)' }
  try {
    const res = await sichererAbruf(imageUrl, { headers: { Referer: pageUrl, 'User-Agent': PAGE_USER_AGENT }, maxBytes: MAX_COVER_BYTES, timeoutMs: 30_000 })
    if (res.status < 200 || res.status >= 300) return { grund: `Bild HTTP ${res.status}` }
    const mimeType = (res.headers['content-type'] ?? '').split(';')[0].trim()
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : ''
    if (!ext) return { grund: `Bild ist kein JPEG/PNG/WebP (Content-Type "${mimeType || 'unbekannt'}")` }
    const buffer = res.buffer
    if (buffer.length === 0) return { grund: 'Bild lieferte 0 Bytes' }
    return { buffer, ext, mimeType }
  } catch (error) {
    return { grund: error instanceof Error ? error.message : String(error) }
  }
}
