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
 * Mit `transkript: "untertitel"` entfallen Medium und Job: der Secretary liefert die
 * fertigen Untertitel der Videoseite, sie liegen als `<Basis> - Untertitel.txt` im
 * Ordner und als Transkript an deren Twin (`untertitel-ablage.ts`). Ohne brauchbare
 * Spur ist das ein Fehler — ausser `rueckfall: true` erlaubt die Tonspur.
 *
 * @module web-source
 */

import { enqueueSourceTranscribeJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { ladeVideoCookies } from '@/lib/video-login/video-login-service'
import { basisName, baueArtikelSammeldatei, verlinkteDateien } from './artikel-sammeldatei'
import { resolveMediaViaSecretary, type ResolvedMedia } from './media-resolve'
import { holeCover, holeMedium } from './medium-und-cover'
import { leseSeitenbild } from './seitenbild'
import { holeUntertitelViaSecretary, type Untertitel } from './untertitel'
import { schreibeUntertitelTranskript, untertitelDateiInhalt, untertitelDateiname, untertitelHerkunft, untertitelHinweise, untertitelSpur, untertitelTranskript } from './untertitel-ablage'
import { embedUrlFuerVideo } from './video-embed'
import type { WebseiteErschliessenInput, WebseiteErschliessenResult } from './webseite-erschliessen-typen'

export type { MetadatenQuelle, SeitenModus } from './seitenbild'
export type { TranskriptErgebnis, WebseiteErschliessenInput, WebseiteErschliessenResult } from './webseite-erschliessen-typen'
export { ladeSeiteHtml } from './seite-laden'

function meldung(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Weg `untertitel`: die fertige Spur der Videoseite. Ohne brauchbare Spur ein Fehler mit dem Grund
 * des Secretary — nur mit `rueckfall` kommt der Grund zurueck und der Aufrufer nimmt die Tonspur.
 */
async function versucheUntertitel(input: WebseiteErschliessenInput, cookies: string | null): Promise<{ untertitel: Untertitel } | { grund: string }> {
  if (Object.keys(input.audioContext).length > 0 && input.rueckfall !== true) {
    throw new Error('sprecherErkennung, kontext und begriffe gelten nur fuer die Transkription der Tonspur — mit transkript "untertitel" weglassen (oder rueckfall: true setzen). Nichts geschrieben.')
  }
  try {
    return { untertitel: await holeUntertitelViaSecretary(input.url, cookies, input.untertitelSprache) }
  } catch (error) {
    if (input.rueckfall === true) return { grund: meldung(error) }
    throw new Error(`Keine Untertitel: ${meldung(error)} — nichts geschrieben. Mit rueckfall: true wird stattdessen die Tonspur transkribiert.`)
  }
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
  const wegUntertitel = input.transkript === 'untertitel'
  if (wegUntertitel && !medienHolen) throw new Error('transkript "untertitel" und medienHolen: false widersprechen sich — eines von beiden weglassen. Nichts geschrieben.')
  const versuch = wegUntertitel ? await versucheUntertitel(input, cookies) : null
  const untertitel = versuch && 'untertitel' in versuch ? versuch.untertitel : null
  const abgerufenAm = new Date()
  let resolved: ResolvedMedia | { fehler: string } | null = null
  if (medienHolen && !untertitel) {
    try {
      resolved = await resolveMediaViaSecretary(url, cookies)
    } catch (error) {
      resolved = { fehler: meldung(error) }
    }
  }
  const bild = await leseSeitenbild(url, untertitel ?? resolved, cookies !== null, input.seitenModus ?? 'artikel', input.seitenHtml)
  const { seite, metadatenQuelle, kapitel, struktur } = bild
  const hinweise = untertitel ? [...bild.hinweise, ...untertitelHinweise(untertitel)] : bild.hinweise

  const medium = untertitel
    ? { grund: 'transkript: untertitel — kein Medium geladen' }
    : medienHolen && resolved ? await holeMedium(seite, resolved, cookies) : { grund: 'medienHolen: false' }
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
  const untertitelDatei = untertitel ? untertitelDateiname(basis) : null
  const herkunft = untertitel ? untertitelHerkunft(untertitel, abgerufenAm) : null
  const medienEinbetten = input.medienEinbetten !== false
  const videoEmbedUrl = medienEinbetten ? embedUrlFuerVideo(url, seite.media) : null
  const markdown = baueArtikelSammeldatei({
    seite, medienDatei, coverDatei, medienDauerSekunden: 'dauer' in medium ? medium.dauer : null, videoEmbedUrl, medienEinbetten,
    kapitel, ohneTextErlaubt: metadatenQuelle === 'ytdlp', struktur,
    untertitel: untertitelDatei && herkunft ? { datei: untertitelDatei, herkunft } : null,
  })

  const geschrieben: Array<{ id: string; name: string }> = []
  let mediumErgebnis: WebseiteErschliessenResult['medium'] = null
  let coverErgebnis: WebseiteErschliessenResult['cover'] = null
  let untertitelErgebnis: WebseiteErschliessenResult['untertitel'] = null
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
    const untertitelItem = untertitel && untertitelDatei
      ? await provider.uploadFile(folderId, new File([untertitelDateiInhalt(untertitel, url, abgerufenAm)], untertitelDatei, { type: 'text/plain' }))
      : null
    if (untertitelItem && untertitelDatei) geschrieben.push({ id: untertitelItem.id, name: untertitelDatei })
    md = await provider.uploadFile(folderId, new File([markdown], dateiname, { type: 'text/markdown' }))
    geschrieben.push({ id: md.id, name: dateiname })
    if (untertitel && untertitelItem && untertitelDatei) {
      // Zuletzt, damit ein Fehler davor keinen Twin ohne Quelldatei hinterlaesst.
      await schreibeUntertitelTranskript({ libraryId, userEmail, provider, quelle: untertitelItem, targetLanguage, markdown: untertitelTranskript(untertitel, url, abgerufenAm) })
      untertitelErgebnis = {
        sourceId: untertitelItem.id, name: untertitelDatei, bytes: untertitelItem.metadata.size,
        woerter: untertitel.abdeckung.woerter, abdeckungAnteil: untertitel.abdeckung.anteil,
      }
    }
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
    throw new Error(
      `${meldung(error)} — ${geschrieben.length - nichtEntfernt.length} schon hochgeladene Datei(en) wieder entfernt` +
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
    seitenModus: struktur ? 'struktur' : 'artikel', verlinkteDateien: struktur ? verlinkteDateien(struktur.links).length : 0,
    transkript: {
      weg: untertitel ? 'untertitel' : mediumErgebnis ? 'tonspur' : 'keins',
      spur: untertitel ? untertitelSpur(untertitel) : null,
      herkunft,
      rueckfallGrund: versuch && 'grund' in versuch ? versuch.grund : null,
    },
    medium: mediumErgebnis,
    untertitel: untertitelErgebnis,
    videoEmbedUrl,
    mediumGrund: 'grund' in medium ? medium.grund : null,
    cover: coverErgebnis,
    coverGrund: 'grund' in cover ? cover.grund : null,
  }
}
