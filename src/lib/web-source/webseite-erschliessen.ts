/**
 * @fileoverview Webseite als Quelle erschliessen: Seite lesen, Medium und Cover
 * holen, Sammeldatei anlegen, Transkription starten.
 *
 * @description
 * Ein Weg fuer Bruecke (`webseite_erschliessen`) und Oberflaeche
 * (`POST /api/library/[id]/web-source`): Die Seite wird ohne Modell gelesen
 * (`page-extract.ts`), das eingebettete Medium ueber den Secretary (yt-dlp)
 * aufgeloest und hier geladen, das Coverbild der Seite geladen, alles neben der
 * Sammeldatei im Zielordner abgelegt (`<Basis>.mp3`, `<Basis>.cover.jpg`,
 * `<Basis>.md`). Fuer das Medium startet derselbe Transkriptions-Job wie bei
 * `quelle_erschliessen` (nur Transkript, kein Ingest). Die Transformation der
 * Sammeldatei ist ein eigener, bewusster Schritt (`transformation_starten`).
 * Jeder ausgelassene Teil (kein Medium, kein Cover) steht mit Grund im Ergebnis.
 *
 * @module web-source
 */

import { enqueueSourceTranscribeJob } from '@/lib/external-jobs/enqueue-secretary-job'
import type { StorageProvider } from '@/lib/storage/types'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { basisName, baueArtikelSammeldatei } from './artikel-sammeldatei'
import { downloadDeclaredMedia, downloadMedia, resolveMediaViaSecretary, type DownloadedMedia } from './media-resolve'
import { extractWebPage, type WebPageExtract } from './page-extract'

const PAGE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 KnowledgeScout'

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
}

export interface WebseiteErschliessenResult {
  sammeldatei: { sourceId: string; name: string; ordnerId: string }
  seite: Pick<WebPageExtract, 'title' | 'siteName' | 'author' | 'datePublished' | 'imageUrl' | 'language'> & { bloecke: number; medienGefunden: number }
  medium: { sourceId: string; name: string; bytes: number; dauerSekunden: number | null; weg: 'secretary' | 'seite'; jobId: string } | null
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

async function holeMedium(seite: WebPageExtract): Promise<{ datei: DownloadedMedia; dauer: number | null; weg: 'secretary' | 'seite' } | { grund: string }> {
  let secretaryFehler: string
  try {
    const resolved = await resolveMediaViaSecretary(seite.url)
    const datei = await downloadMedia(resolved.directUrl, { ext: resolved.ext, httpHeaders: resolved.httpHeaders })
    return { datei, dauer: resolved.duration, weg: 'secretary' }
  } catch (error) {
    secretaryFehler = error instanceof Error ? error.message : String(error)
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

async function holeCover(imageUrl: string, pageUrl: string): Promise<{ buffer: Buffer; ext: string; mimeType: string } | { grund: string }> {
  if (!imageUrl) return { grund: 'Seite nennt kein Bild (og:image/JSON-LD)' }
  try {
    const res = await fetchWithTimeout(imageUrl, { headers: { Referer: pageUrl, 'User-Agent': PAGE_USER_AGENT }, timeoutMs: 30_000 })
    if (!res.ok) return { grund: `Bild HTTP ${res.status}` }
    const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : ''
    if (!ext) return { grund: `Bild ist kein JPEG/PNG/WebP (Content-Type "${mimeType || 'unbekannt'}")` }
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0) return { grund: 'Bild lieferte 0 Bytes' }
    return { buffer, ext, mimeType }
  } catch (error) {
    return { grund: error instanceof Error ? error.message : String(error) }
  }
}

/** Fuehrt den ganzen Weg aus; wirft bei Seite ohne Text oder vorhandenem Dateinamen, nichts geschrieben. */
export async function webseiteErschliessen(input: WebseiteErschliessenInput): Promise<WebseiteErschliessenResult> {
  const { libraryId, userEmail, provider, url, folderId, dateiname, targetLanguage, audioContext, llmModel, medienHolen } = input
  if (!/\.md$/i.test(dateiname)) throw new Error(`dateiname "${dateiname}" muss auf .md enden`)
  const basis = basisName(dateiname)

  const vorhanden = await provider.listItemsById(folderId)
  const kollision = vorhanden.find((i) => i.type === 'file' && i.metadata.name.toLowerCase().startsWith(basis.toLowerCase() + '.'))
  if (kollision) throw new Error(`"${kollision.metadata.name}" gibt es in diesem Ordner schon — anderen Dateinamen waehlen. Nichts geschrieben.`)

  const seite = extractWebPage(await ladeSeiteHtml(url), url)
  if (seite.bloecke.length === 0) throw new Error('Seite ohne Artikeltext (keine Absaetze in article/main/body) — nichts geschrieben')

  // Erst alles laden, dann schreiben: ein Fehler beim Laden laesst den Ordner unberuehrt.
  const medium = medienHolen ? await holeMedium(seite) : { grund: 'medienHolen: false' }
  const cover = await holeCover(seite.imageUrl, url)

  const medienDatei = 'datei' in medium ? `${basis}.${medium.datei.ext}` : null
  const coverDatei = 'buffer' in cover ? `${basis}.cover.${cover.ext}` : null
  const markdown = baueArtikelSammeldatei({ seite, medienDatei, coverDatei, medienDauerSekunden: 'dauer' in medium ? medium.dauer : null })

  let mediumErgebnis: WebseiteErschliessenResult['medium'] = null
  if ('datei' in medium && medienDatei) {
    const item = await provider.uploadFile(folderId, new File([new Uint8Array(medium.datei.buffer)], medienDatei, { type: medium.datei.mimeType }))
    const { jobId } = await enqueueSourceTranscribeJob({
      libraryId, userEmail,
      source: { itemId: item.id, parentId: folderId, name: medienDatei, mimeType: medium.datei.mimeType },
      mediaType: medium.datei.mimeType.startsWith('video/') ? 'video' : 'audio',
      template: undefined, llmModel, targetLanguage, audioContext, ingest: false,
    })
    mediumErgebnis = { sourceId: item.id, name: medienDatei, bytes: medium.datei.buffer.length, dauerSekunden: medium.dauer, weg: medium.weg, jobId }
  }
  let coverErgebnis: WebseiteErschliessenResult['cover'] = null
  if ('buffer' in cover && coverDatei) {
    const item = await provider.uploadFile(folderId, new File([new Uint8Array(cover.buffer)], coverDatei, { type: cover.mimeType }))
    coverErgebnis = { sourceId: item.id, name: coverDatei, bytes: cover.buffer.length }
  }
  const md = await provider.uploadFile(folderId, new File([markdown], dateiname, { type: 'text/markdown' }))

  return {
    sammeldatei: { sourceId: md.id, name: dateiname, ordnerId: folderId },
    seite: {
      title: seite.title, siteName: seite.siteName, author: seite.author, datePublished: seite.datePublished,
      imageUrl: seite.imageUrl, language: seite.language, bloecke: seite.bloecke.length, medienGefunden: seite.media.length,
    },
    medium: mediumErgebnis,
    mediumGrund: 'grund' in medium ? medium.grund : null,
    cover: coverErgebnis,
    coverGrund: 'grund' in cover ? cover.grund : null,
  }
}
