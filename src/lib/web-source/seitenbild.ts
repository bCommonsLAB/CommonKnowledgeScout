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

import { istVideoExtractor, type MediaKapitel } from './media-metadata'
import type { ResolvedMedia } from './media-resolve'
import { seiteAusMetadaten } from './metadaten-seite'
import type { WebPageExtract } from './page-extract'
import type { SeitenLink } from './seite-links'
import { HINWEIS_OHNE_TEXT, leseSeite } from './seite-lesen'
import { embedUrlAusAdresse } from './video-embed'

export type MetadatenQuelle = 'ytdlp' | 'seite'

/**
 * Wie die Seite in die Sammeldatei kommt: `artikel` = Absaetze des Artikeltexts (Vorgabe),
 * `struktur` = die Seite woertlich mit Listen, Tabellen und Links — fuer Uebersichts-,
 * Termin- und Dokumentseiten, die keinen Fliesstext tragen.
 */
export type SeitenModus = 'artikel' | 'struktur'

export interface Seitenbild {
  seite: WebPageExtract
  metadatenQuelle: MetadatenQuelle
  kapitel: MediaKapitel[]
  hinweise: string[]
  /** Nur im Modus `struktur`: woertliches Markdown der Seite und ihre Links. */
  struktur?: { markdown: string; links: SeitenLink[] }
}

/** Seitenbild aus yt-dlp bei Videoseiten, sonst aus dem HTML; `videoAnmeldung` nur fuer die Fehlermeldung. */
export async function leseSeitenbild(url: string, resolved: ResolvedMedia | { fehler: string } | null, videoAnmeldung: boolean, modus: SeitenModus = 'artikel'): Promise<Seitenbild> {
  const hinweise: string[] = []
  if (resolved && !('fehler' in resolved) && istVideoExtractor(resolved.extractor)) {
    if (resolved.metadata) {
      const seite = seiteAusMetadaten({ url, title: resolved.title, metadata: resolved.metadata })
      hinweise.push(seite.datePublished
        ? 'Datum ist das Upload-Datum (upload_date) — nicht unbedingt das Datum des Anlasses; der Mensch bestaetigt es'
        : 'yt-dlp nennt kein Upload-Datum — date bleibt leer, mit dokument_felder_setzen nachtragen')
      if (seite.bloecke.length === 0) hinweise.push('Videoseite ohne Beschreibung — die Sammeldatei traegt keinen Artikeltext, das Transkript ist das Material')
      if (modus === 'struktur') hinweise.push('seitenModus "struktur" ohne Wirkung: Videoseite, das Seitenbild kommt aus yt-dlp')
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
  const gelesen = await leseSeite(url)
  // source_url bleibt die genannte Adresse, auch nach einer Umleitung (wie bisher).
  const seite: WebPageExtract = { ...gelesen.meta, url }
  if (modus === 'struktur') {
    if (!gelesen.markdown.trim()) throw new Error(`${HINWEIS_OHNE_TEXT} Nichts geschrieben.`)
    return { seite, metadatenQuelle: 'seite', kapitel: [], hinweise, struktur: { markdown: gelesen.markdown, links: gelesen.links } }
  }
  if (seite.bloecke.length === 0) {
    throw new Error(
      'Seite ohne Artikeltext (keine Absaetze in article/main/body) — nichts geschrieben. ' +
        (gelesen.markdown.trim()
          ? 'Die Seite traegt aber Listen, Tabellen oder Links: mit seitenModus "struktur" wird sie woertlich uebernommen (vorher mit seite_lesen ansehen).'
          : HINWEIS_OHNE_TEXT),
    )
  }
  return { seite, metadatenQuelle: 'seite', kapitel: [], hinweise }
}
