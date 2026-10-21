/**
 * @fileoverview Webseite als Quelle erschliessen: Seite lesen, Medium und Cover
 * holen, Sammeldatei anlegen, Transkription starten.
 *
 * @description
 * Ein Weg fuer Bruecke (`webseite_erschliessen`, `playlist_erschliessen`) und
 * Oberflaeche (`POST /api/library/[id]/web-source`). Zwei Quellen fuer das
 * Seitenbild (Welle K2): Kennt yt-dlp die Seite als Videoseite (youtube, vimeo,
 * peertube) und liefert der Secretary den Metadaten-Block, kommen Titel,
 * Beschreibung (woertlich), Datum (upload_date), Kanal, Kapitel und Cover aus
 * yt-dlp (`metadatenQuelle: ytdlp`); sonst wird die Seite ohne Modell gelesen
 * (`page-extract.ts`, `metadatenQuelle: seite`). Dateien im Zielordner:
 * `<Basis> - Audio.m4a`, `<Basis> - Cover.jpg`, `<Basis>.md` — NICHT
 * `<Basis>.mp3`, das gilt im Twin-System als Transkript (Geschwister-Regel,
 * Befund 13.10.2026). Transkriptions-Job wie bei `quelle_erschliessen` (kein
 * Ingest). Jeder ausgelassene Teil steht mit Grund im Ergebnis; nichts wird geraten.
 *
 * @module web-source
 */

import { enqueueSourceTranscribeJob } from '@/lib/external-jobs/enqueue-secretary-job'
import type { StorageProvider } from '@/lib/storage/types'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { basisName, baueArtikelSammeldatei } from './artikel-sammeldatei'
import { istVideoExtractor, type MediaKapitel } from './media-metadata'
import { resolveMediaViaSecretary, type ResolvedMedia } from './media-resolve'
import { holeCover, holeMedium, PAGE_USER_AGENT, type MediumWeg } from './medium-und-cover'
import { seiteAusMetadaten } from './metadaten-seite'
import { extractWebPage, type WebPageExtract } from './page-extract'
import { embedUrlAusAdresse, embedUrlFuerVideo } from './video-embed'

export type MetadatenQuelle = 'ytdlp' | 'seite'

export interface WebseiteErschliessenInput {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  url: string
  folderId: string
  /** Dateiname der Sammeldatei, endet auf .md. */
  dateiname: string
  targetLanguage: string
  /** Typgepruefte Audio-Optionen (Sprechererkennung, Kontext, Begriffe) wie bei quelle_erschliessen. */
  audioContext: Record<string, unknown>
  llmModel?: string
  /** false = Seite nur lesen und Sammeldatei anlegen, kein Medium holen. */
  medienHolen: boolean
  /** false = Medium nur als Quelle (Transkription), ohne Player und Video-Embed. Default true. */
  medienEinbetten?: boolean
  /** Welle K3: Stapel-Zugehoerigkeit, die der Transkriptions-Job erbt. */
  batch?: { batchId: string; batchName?: string }
}

export interface WebseiteErschliessenResult {
  sammeldatei: { sourceId: string; name: string; ordnerId: string }
  seite: Pick<WebPageExtract, 'title' | 'siteName' | 'author' | 'datePublished' | 'imageUrl' | 'language'> & { bloecke: number; medienGefunden: number }
  /** Woher Titel, Text, Datum und Cover kommen: yt-dlp-Metadaten oder das HTML der Seite. */
  metadatenQuelle: MetadatenQuelle
  /** Zahl der Kapitel aus yt-dlp (0 ohne). */
  kapitel: number
  /** Was der Mensch wissen sollte (Datum ist Upload-Datum, Video ohne Beschreibung, Secretary ohne Metadaten-Block). */
  hinweise: string[]
  medium: { sourceId: string; name: string; bytes: number; dauerSekunden: number | null; weg: MediumWeg; jobId: string } | null
  /** Embed-Adresse (YouTube/Vimeo/PeerTube) fuer video_url, sonst null. */
  videoEmbedUrl: string | null
  mediumGrund: string | null
  cover: { sourceId: string; name: string; bytes: number } | null
  coverGrund: string | null
}

/** Laedt das HTML einer Seite (Browser-UA, Timeout). */
export async function ladeSeiteHtml(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': PAGE_USER_AGENT, Accept: 'text/html,*/*' }, timeoutMs: 30_000 })
  if (!res.ok) throw new Error(`Seite nicht ladbar: HTTP ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  if (!/html|xml/i.test(type)) throw new Error(`Adresse liefert kein HTML (Content-Type "${type || 'unbekannt'}")`)
  return res.text()
}

interface Seitenbild { seite: WebPageExtract; metadatenQuelle: MetadatenQuelle; kapitel: MediaKapitel[]; hinweise: string[] }

/** Welle K2: Seitenbild aus yt-dlp bei Videoseiten, sonst aus dem HTML. */
async function leseSeitenbild(url: string, resolved: ResolvedMedia | { fehler: string } | null): Promise<Seitenbild> {
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
  // Videoseite ohne yt-dlp (z. B. YouTube-Bot-Sperre): „Seite ohne Artikeltext" wuerde die Ursache verdecken (Cowork 21.10.).
  if (resolved && 'fehler' in resolved && embedUrlAusAdresse(url)) {
    throw new Error(`Videoseite, aber yt-dlp scheitert: ${resolved.fehler} — nichts geschrieben`)
  }
  const seite = extractWebPage(await ladeSeiteHtml(url), url)
  if (seite.bloecke.length === 0) throw new Error('Seite ohne Artikeltext (keine Absaetze in article/main/body) — nichts geschrieben')
  return { seite, metadatenQuelle: 'seite', kapitel: [], hinweise }
}

/** Fuehrt den ganzen Weg aus; wirft bei Seite ohne Text oder vorhandenem Dateinamen, nichts geschrieben. */
export async function webseiteErschliessen(input: WebseiteErschliessenInput): Promise<WebseiteErschliessenResult> {
  const { libraryId, userEmail, provider, url, folderId, dateiname, targetLanguage, audioContext, llmModel, medienHolen } = input
  if (!/\.md$/i.test(dateiname)) throw new Error(`dateiname "${dateiname}" muss auf .md enden`)
  const basis = basisName(dateiname)

  const vorhanden = await provider.listItemsById(folderId)
  const kollision = vorhanden.find((i) => i.type === 'file' && i.metadata.name.toLowerCase().startsWith(basis.toLowerCase()))
  if (kollision) throw new Error(`"${kollision.metadata.name}" gibt es in diesem Ordner schon — anderen Dateinamen waehlen. Nichts geschrieben.`)

  let resolved: ResolvedMedia | { fehler: string } | null = null
  if (medienHolen) {
    try {
      resolved = await resolveMediaViaSecretary(url)
    } catch (error) {
      resolved = { fehler: error instanceof Error ? error.message : String(error) }
    }
  }
  const { seite, metadatenQuelle, kapitel, hinweise } = await leseSeitenbild(url, resolved)

  const medium = medienHolen && resolved ? await holeMedium(seite, resolved) : { grund: 'medienHolen: false' }
  const cover = await holeCover(seite.imageUrl, url)

  const istVideo = 'datei' in medium && medium.datei.mimeType.startsWith('video/')
  if (istVideo && Object.keys(audioContext).length > 0) {
    throw new Error(
      'Das Medium dieser Seite kam nur als Video (ohne extrahierbare Tonspur) — sprecherErkennung, kontext und begriffe ' +
        'gelten nur fuer Audio. Ohne diese Angaben erneut aufrufen. Nichts geschrieben.',
    )
  }
  const medienDatei = 'datei' in medium ? `${basis} - ${istVideo ? 'Video' : 'Audio'}.${medium.datei.ext}` : null
  const coverDatei = 'buffer' in cover ? `${basis} - Cover.${cover.ext}` : null
  const medienEinbetten = input.medienEinbetten !== false
  const videoEmbedUrl = medienEinbetten ? embedUrlFuerVideo(url, seite.media) : null
  const markdown = baueArtikelSammeldatei({
    seite, medienDatei, coverDatei, medienDauerSekunden: 'dauer' in medium ? medium.dauer : null, videoEmbedUrl, medienEinbetten,
    kapitel, ohneTextErlaubt: metadatenQuelle === 'ytdlp',
  })

  const geschrieben: Array<{ id: string; name: string }> = []
  let mediumErgebnis: WebseiteErschliessenResult['medium'] = null
  let coverErgebnis: WebseiteErschliessenResult['cover'] = null
  let md: { id: string }
  try {
    let mediumItemId: string | null = null
    if ('datei' in medium && medienDatei) {
      const item = await provider.uploadFile(folderId, new File([new Uint8Array(medium.datei.buffer)], medienDatei, { type: medium.datei.mimeType }))
      geschrieben.push({ id: item.id, name: medienDatei })
      mediumItemId = item.id
    }
    if ('buffer' in cover && coverDatei) {
      const item = await provider.uploadFile(folderId, new File([new Uint8Array(cover.buffer)], coverDatei, { type: cover.mimeType }))
      geschrieben.push({ id: item.id, name: coverDatei })
      coverErgebnis = { sourceId: item.id, name: coverDatei, bytes: cover.buffer.length }
    }
    md = await provider.uploadFile(folderId, new File([markdown], dateiname, { type: 'text/markdown' }))
    geschrieben.push({ id: md.id, name: dateiname })
    if ('datei' in medium && medienDatei && mediumItemId) {
      const { jobId } = await enqueueSourceTranscribeJob({
        libraryId, userEmail,
        source: { itemId: mediumItemId, parentId: folderId, name: medienDatei, mimeType: medium.datei.mimeType },
        mediaType: istVideo ? 'video' : 'audio',
        template: undefined, llmModel, targetLanguage, audioContext, ingest: false, batch: input.batch,
      })
      mediumErgebnis = { sourceId: mediumItemId, name: medienDatei, bytes: medium.datei.buffer.length, dauerSekunden: medium.dauer, weg: medium.weg, jobId }
    }
  } catch (error) {
    const nichtEntfernt: string[] = []
    for (const g of geschrieben) {
      try {
        await provider.deleteItem(g.id)
      } catch {
        nichtEntfernt.push(g.name)
      }
    }
    const grund = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${grund} — ${geschrieben.length - nichtEntfernt.length} schon hochgeladene Datei(en) wieder entfernt` +
        (nichtEntfernt.length > 0 ? `; NICHT entfernt, bitte von Hand loeschen: ${nichtEntfernt.join(', ')}` : ''),
    )
  }

  return {
    sammeldatei: { sourceId: md.id, name: dateiname, ordnerId: folderId },
    seite: {
      title: seite.title, siteName: seite.siteName, author: seite.author, datePublished: seite.datePublished,
      imageUrl: seite.imageUrl, language: seite.language, bloecke: seite.bloecke.length, medienGefunden: seite.media.length,
    },
    metadatenQuelle, kapitel: kapitel.length, hinweise,
    medium: mediumErgebnis,
    videoEmbedUrl,
    mediumGrund: 'grund' in medium ? medium.grund : null,
    cover: coverErgebnis,
    coverGrund: 'grund' in cover ? cover.grund : null,
  }
}
