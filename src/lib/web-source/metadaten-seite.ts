/**
 * @fileoverview Seitenbild einer Videoseite aus yt-dlp-Metadaten statt aus dem HTML (Welle K2).
 *
 * @description
 * YouTube, Vimeo und PeerTube liefern im Server-HTML kaum Text (die Seite
 * rendert per JavaScript, `og:description` ist gekuerzt). yt-dlp kennt die
 * Seite besser: Titel, Beschreibung woertlich, Upload-Datum, Kanal, Kapitel,
 * Vorschaubild. Daraus entsteht dieselbe `WebPageExtract`-Form wie aus dem
 * HTML-Weg, damit Sammeldatei und Vorlage unveraendert bleiben. Chronist,
 * nicht Kommentator: die Beschreibung wird in Absaetze an Leerzeilen
 * geteilt, sonst nicht angefasst. Was yt-dlp nicht liefert, bleibt leer.
 *
 * @module web-source
 */

import type { MediaMetadata } from './media-metadata'
import type { WebPageExtract } from './page-extract'

/** Beschreibung woertlich in Absaetze an Leerzeilen; Zeilen innerhalb eines Absatzes bleiben. */
export function beschreibungInBloecke(description: string): string[] {
  return description
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((abs) => abs.split('\n').map((z) => z.trimEnd()).join('\n').trim())
    .filter((abs) => abs.length > 0)
}

/** Seitenbild aus yt-dlp: Titel vom Resolve, alles Weitere aus dem Metadaten-Block. */
export function seiteAusMetadaten(args: { url: string; title: string; metadata: MediaMetadata }): WebPageExtract {
  const { url, title, metadata } = args
  if (!title.trim()) throw new Error('yt-dlp nennt keinen Titel fuer diese Videoseite')
  return {
    url: metadata.webpageUrl || url,
    title: title.trim(),
    // Die Beschreibung steht woertlich im Body; eine Kurzfassung gaebe es nur geraten.
    description: '',
    siteName: metadata.channel || metadata.uploader,
    author: '',
    datePublished: metadata.uploadDate,
    imageUrl: metadata.thumbnail,
    language: '',
    bloecke: beschreibungInBloecke(metadata.description),
    media: [],
  }
}
