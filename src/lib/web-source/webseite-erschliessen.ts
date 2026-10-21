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
import { ladeVideoCookies } from '@/lib/video-login/video-login-service'
import { basisName, baueArtikelSammeldatei } from './artikel-sammeldatei'
import { resolveMediaViaSecretary, type ResolvedMedia } from './media-resolve'
import { holeCover, holeMedium, type MediumWeg } from './medium-und-cover'
import type { WebPageExtract } from './page-extract'
import { leseSeitenbild, type MetadatenQuelle } from './seitenbild'
import { embedUrlFuerVideo } from './video-embed'

export type { MetadatenQuelle } from './seitenbild'
export { ladeSeiteHtml } from './seitenbild'

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
  /** Welle C3: Video-Anmeldung (cookies.txt); weggelassen = vom Konto der Person laden, null = ohne. */
  videoCookies?: string | null
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

/** Fuehrt den ganzen Weg aus; wirft bei Seite ohne Text oder vorhandenem Dateinamen, nichts geschrieben. */
export async function webseiteErschliessen(input: WebseiteErschliessenInput): Promise<WebseiteErschliessenResult> {
  const { libraryId, userEmail, provider, url, folderId, dateiname, targetLanguage, audioContext, llmModel, medienHolen } = input
  if (!/\.md$/i.test(dateiname)) throw new Error(`dateiname "${dateiname}" muss auf .md enden`)
  const basis = basisName(dateiname)

  const vorhanden = await provider.listItemsById(folderId)
  const kollision = vorhanden.find((i) => i.type === 'file' && i.metadata.name.toLowerCase().startsWith(basis.toLowerCase()))
  if (kollision) throw new Error(`"${kollision.metadata.name}" gibt es in diesem Ordner schon — anderen Dateinamen waehlen. Nichts geschrieben.`)

  // Welle C3: Die Video-Anmeldung der Person geht mit jedem yt-dlp-Aufruf mit (Cookie-Datei am Konto, nie am Server).
  const cookies = input.videoCookies === undefined ? await ladeVideoCookies(userEmail) : input.videoCookies
  let resolved: ResolvedMedia | { fehler: string } | null = null
  if (medienHolen) {
    try {
      resolved = await resolveMediaViaSecretary(url, cookies)
    } catch (error) {
      resolved = { fehler: error instanceof Error ? error.message : String(error) }
    }
  }
  const { seite, metadatenQuelle, kapitel, hinweise } = await leseSeitenbild(url, resolved, cookies !== null)

  const medium = medienHolen && resolved ? await holeMedium(seite, resolved, cookies) : { grund: 'medienHolen: false' }
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
