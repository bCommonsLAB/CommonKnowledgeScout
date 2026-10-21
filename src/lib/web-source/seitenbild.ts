/**
 * @fileoverview Seitenbild einer Quelle: aus yt-dlp-Metadaten oder aus dem HTML (aus `webseite-erschliessen.ts` ausgelagert).
 *
 * @description
 * Kennt yt-dlp die Seite als Videoseite (youtube, vimeo, peertube) und liefert
 * der Secretary den Metadaten-Block, kommen Titel, Beschreibung, Datum, Kanal,
 * Kapitel und Cover aus yt-dlp (`metadatenQuelle: ytdlp`); sonst wird das HTML
 * ohne Modell gelesen (`seite`). Eine Videoseite, deren yt-dlp-Abruf scheitert
 * (z. B. YouTube-Bot-Sperre), scheitert MIT diesem Grund — „Seite ohne
 * Artikeltext" wuerde die Ursache verdecken (Cowork-Test 21.10.2026).
 *
 * @module web-source
 */

import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { istVideoExtractor, type MediaKapitel } from './media-metadata'
import type { ResolvedMedia } from './media-resolve'
import { PAGE_USER_AGENT } from './medium-und-cover'
import { seiteAusMetadaten } from './metadaten-seite'
import { extractWebPage, type WebPageExtract } from './page-extract'
import { embedUrlAusAdresse } from './video-embed'

export type MetadatenQuelle = 'ytdlp' | 'seite'

export interface Seitenbild {
  seite: WebPageExtract
  metadatenQuelle: MetadatenQuelle
  kapitel: MediaKapitel[]
  hinweise: string[]
}

/** Laedt das HTML einer Seite (Browser-UA, Timeout). */
export async function ladeSeiteHtml(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': PAGE_USER_AGENT, Accept: 'text/html,*/*' }, timeoutMs: 30_000 })
  if (!res.ok) throw new Error(`Seite nicht ladbar: HTTP ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  if (!/html|xml/i.test(type)) throw new Error(`Adresse liefert kein HTML (Content-Type "${type || 'unbekannt'}")`)
  return res.text()
}

/** Seitenbild aus yt-dlp bei Videoseiten, sonst aus dem HTML; `videoAnmeldung` nur fuer die Fehlermeldung. */
export async function leseSeitenbild(url: string, resolved: ResolvedMedia | { fehler: string } | null, videoAnmeldung: boolean): Promise<Seitenbild> {
  const hinweise: string[] = []
  if (resolved && !('fehler' in resolved) && istVideoExtractor(resolved.extractor)) {
    if (resolved.metadata) {
      const seite = seiteAusMetadaten({ url, title: resolved.title, metadata: resolved.metadata })
      hinweise.push(seite.datePublished
        ? 'Datum ist das Upload-Datum (upload_date) — nicht unbedingt das Datum des Anlasses; der Mensch bestaetigt es'
        : 'yt-dlp nennt kein Upload-Datum — date bleibt leer, mit dokument_felder_setzen nachtragen')
      if (seite.bloecke.length === 0) hinweise.push('Videoseite ohne Beschreibung — die Sammeldatei traegt keinen Artikeltext, das Transkript ist das Material')
      return { seite, metadatenQuelle: 'ytdlp', kapitel: resolved.metadata.kapitel, hinweise }
    }
    hinweise.push(`yt-dlp kennt die Seite als ${resolved.extractor}, der Secretary liefert aber keinen metadata-Block (Welle S fehlt) — Seitenbild aus dem HTML`)
  }
  if (resolved && 'fehler' in resolved && embedUrlAusAdresse(url)) {
    throw new Error(
      `Videoseite, aber yt-dlp scheitert: ${resolved.fehler} — nichts geschrieben ` +
        `(Video-Anmeldung am Konto: ${videoAnmeldung ? 'hinterlegt' : 'nicht hinterlegt — Einstellungen → Mein Zugang'})`,
    )
  }
  const seite = extractWebPage(await ladeSeiteHtml(url), url)
  if (seite.bloecke.length === 0) throw new Error('Seite ohne Artikeltext (keine Absaetze in article/main/body) — nichts geschrieben')
  return { seite, metadatenQuelle: 'seite', kapitel: [], hinweise }
}
