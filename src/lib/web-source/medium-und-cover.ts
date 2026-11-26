/**
 * @fileoverview Medium und Cover einer Webseite laden (aus `webseite-erschliessen.ts` ausgelagert).
 *
 * @description
 * Medium: Eine direkte AUDIO-Datei (http/https) laedt KnowledgeScout selbst — ausser die
 * Quelle drosselt einen Abruf am Stueck (yt-dlp `http_chunk_size`, z. B. YouTube: rund
 * 30 KiB/s statt mehrerer MiB/s in Teilbereichen; Befund 25.11.2026). Solche Quellen,
 * Streams (HLS/DASH) und Videos laedt der Secretary und zieht nur die Tonspur heraus
 * (m4a) — gebraucht wird die Transkription, und Audio-Optionen gelten nur fuer Audio
 * (Befund Cowork-Test 13.10.). Scheitert der eigene Abruf, versucht es der Secretary;
 * scheitert auch der, bleibt die von der Seite genannte Adresse als letzter Weg.
 * Jeder Ausfall endet mit Grund.
 * Cover: das Bild, das Seite oder yt-dlp nennen (JPEG/PNG/WebP).
 *
 * @module web-source
 */

import { AdresseGesperrtError } from './adress-schutz'
import { downloadDeclaredMedia, downloadMedia, downloadMediaViaSecretary, type DownloadedMedia, type ResolvedMedia } from './media-resolve'
import type { WebPageExtract } from './page-extract'
import { PAGE_USER_AGENT } from './seite-laden'
import { AbrufZuGrossError, sichererAbruf } from './sicherer-abruf'

export { PAGE_USER_AGENT } from './seite-laden'

/** Obergrenze fuer ein Coverbild. */
const MAX_COVER_BYTES = 20 * 1024 * 1024

export type MediumWeg = 'secretary' | 'secretary-download' | 'seite'

export type MediumErgebnis = { datei: DownloadedMedia; dauer: number | null; weg: MediumWeg } | { grund: string }

export type CoverErgebnis = { buffer: Buffer; ext: string; mimeType: string } | { grund: string }

function meldung(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Drosselt die Quelle einen Abruf am Stueck? Dann laedt der Secretary (yt-dlp, in Teilbereichen). */
function drosseltAbrufAmStueck(resolved: ResolvedMedia): boolean {
  if (resolved.httpChunkSize !== null) return true
  // UEBERGANGSREGEL (25.11.2026): Der Secretary liefert `http_chunk_size` erst nach seinem naechsten
  // Ausrollen; bis dahin fehlt das Feld und YouTube gilt am Extractor-Namen als gedrosselt.
  // Entfernen, sobald der Secretary das Feld in Prod liefert — dann sagt es die Quelle selbst.
  return resolved.extractor.trim().toLowerCase() === 'youtube'
}

/** Diese Absagen des eigenen Abrufs umgeht kein zweiter Weg: gesperrte Adresse (Schutz) und Groessengrenze. */
function istEndgueltig(error: unknown): boolean {
  return error instanceof AdresseGesperrtError || error instanceof AbrufZuGrossError
}

/** Laedt das Medium; `resolved` ist das Ergebnis von media/resolve oder dessen Fehler. */
export async function holeMedium(seite: WebPageExtract, resolved: ResolvedMedia | { fehler: string }, cookies: string | null = null): Promise<MediumErgebnis> {
  let secretaryFehler: string
  if ('fehler' in resolved) {
    secretaryFehler = resolved.fehler
  } else {
    const ergebnis = await ladeUeberSecretary(seite, resolved, cookies)
    if ('datei' in ergebnis) return ergebnis
    secretaryFehler = ergebnis.grund
  }
  const direkt = seite.media.find((m) => m.art === 'audio' || m.art === 'video')
  if (!direkt) return { grund: `yt-dlp: ${secretaryFehler}; die Seite nennt keine direkte Audio-/Video-Adresse` }
  try {
    const datei = await downloadDeclaredMedia(direkt.url, seite.url)
    return { datei, dauer: null, weg: 'seite' }
  } catch (error) {
    return { grund: `yt-dlp: ${secretaryFehler}; Adresse der Seite (${direkt.herkunft}): ${meldung(error)}` }
  }
}

/** Die von yt-dlp aufgeloeste Adresse: erst der eigene Abruf (wo er taugt), dann der Download des Secretary. */
async function ladeUeberSecretary(seite: WebPageExtract, resolved: ResolvedMedia, cookies: string | null): Promise<MediumErgebnis> {
  let direktFehler: string | null = null
  if (/^https?$/i.test(resolved.protocol) && resolved.istAudio && !drosseltAbrufAmStueck(resolved)) {
    try {
      const datei = await downloadMedia(resolved.directUrl, { ext: resolved.ext, istAudio: resolved.istAudio, httpHeaders: resolved.httpHeaders })
      return { datei, dauer: resolved.duration, weg: 'secretary' }
    } catch (error) {
      if (istEndgueltig(error)) return { grund: `Direktabruf: ${meldung(error)}` }
      direktFehler = meldung(error)
    }
  }
  try {
    const geladen = await downloadMediaViaSecretary(seite.url, undefined, cookies)
    return { datei: { buffer: geladen.buffer, mimeType: geladen.mimeType, ext: geladen.ext }, dauer: geladen.duration ?? resolved.duration, weg: 'secretary-download' }
  } catch (error) {
    return { grund: direktFehler === null ? meldung(error) : `Direktabruf: ${direktFehler}; Secretary-Download: ${meldung(error)}` }
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
