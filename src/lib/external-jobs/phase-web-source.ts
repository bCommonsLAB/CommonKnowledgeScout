/**
 * @fileoverview External-Job Phase: Webseite/Playlist-Video erschliessen (Welle K3).
 *
 * @description
 * Zwei Operationen desselben Job-Typs `web-source` (Domaene external-jobs,
 * ADR 0001, ohne Secretary-Worker-Pfad; Status und Fehler schreibt die Phase
 * selbst, wie golden-set):
 * - `erschliessen`: ruft `webseiteErschliessen` fuer den Ordner eines Videos
 *   (Sammeldatei, Tonspur, Cover, Transkriptions-Job mit derselben batchId)
 *   und legt das Ergebnis als `cumulativeMeta.webSource` an den Job.
 * - `playlist-lesen`: loest die Playlist auf, holt je Video die Metadaten
 *   (Upload-Datum) und legt die Liste mit Ordnervorschlag `JJJJ-MM-TT Titel`
 *   als `cumulativeMeta.playlist` an den Job; Fortschritt in `job.logs`.
 *
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveMediaViaSecretary } from '@/lib/web-source/media-resolve'
import { ordnerVorschlag } from '@/lib/web-source/playlist-auswahl'
import { resolvePlaylistViaSecretary } from '@/lib/web-source/playlist-resolve'
import { webseiteErschliessen } from '@/lib/web-source/webseite-erschliessen'
import type { ExternalJob } from '@/types/external-job'
import {
  WEB_SOURCE_OP_ERSCHLIESSEN, WEB_SOURCE_OP_PLAYLIST_LESEN, WEB_SOURCE_STEP, lesePlaylistLesenOptionen, leseWebSourceOptionen,
} from './enqueue-web-source'

export interface PlaylistLesenEintrag {
  position: number
  id: string
  titel: string
  url: string
  /** Upload-Datum YYYY-MM-DD oder leer (yt-dlp nennt keines). */
  datum: string
  ordnerVorschlag: string
  /** Grund, wenn der Eintrag nicht lesbar war. */
  grund: string | null
}

async function erschliesseVideo(job: ExternalJob, repo: ExternalJobsRepository): Promise<void> {
  const optionen = leseWebSourceOptionen(job)
  const batchId = job.correlation?.batchId
  const provider = await getServerProvider(job.userEmail, job.libraryId)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar')
  await repo.pushLog(job.jobId, { phase: WEB_SOURCE_STEP, progress: 5, message: `Video ${optionen.position} „${optionen.titel}": Metadaten und Tonspur werden geholt` })
  const ergebnis = await webseiteErschliessen({
    libraryId: job.libraryId, userEmail: job.userEmail, provider,
    url: optionen.url, folderId: optionen.folderId, dateiname: optionen.dateiname,
    targetLanguage: optionen.targetLanguage, audioContext: optionen.audioContext, llmModel: optionen.llmModel,
    medienHolen: true, medienEinbetten: optionen.medienEinbetten,
    ...(batchId ? { batch: { batchId, batchName: job.correlation?.batchName } } : {}),
  })
  await repo.appendMeta(job.jobId, { webSource: { ordner: optionen.ordner, ...ergebnis } }, 'phase-web-source')
  await repo.updateStep(job.jobId, WEB_SOURCE_STEP, {
    status: 'completed', endedAt: new Date(),
    details: {
      sammeldatei: ergebnis.sammeldatei.name, metadatenQuelle: ergebnis.metadatenQuelle, datum: ergebnis.seite.datePublished || null,
      transkriptionJobId: ergebnis.medium?.jobId ?? null, mediumGrund: ergebnis.mediumGrund, coverGrund: ergebnis.coverGrund,
    },
  })
}

export interface PlaylistLesenBilanz {
  eintraege: number
  /** Eintraege, die yt-dlp lesen konnte (nicht privat/geloescht). */
  lesbar: number
  /** Lesbare Eintraege ohne Datum — auch die, deren Abruf scheiterte. */
  ohneDatum: number
  /** Lesbare Eintraege, deren Abruf scheiterte (Fehler des Secretary/yt-dlp). */
  fehlgeschlagen: number
  ersterFehler: string | null
}

type LesenZeile = PlaylistLesenEintrag & { fehler?: boolean }

/** Bilanz des Lesejobs (rein). Cowork-Befund 21.10.: 32 Fehlschlaege ergaben ohneDatum: 0 und completed. */
export function playlistLesenBilanz(eintraege: ReadonlyArray<LesenZeile>): PlaylistLesenBilanz {
  const lesbare = eintraege.filter((e) => !e.grund?.startsWith('nicht abrufbar:'))
  const gescheitert = lesbare.filter((e) => e.fehler === true)
  return {
    eintraege: eintraege.length, lesbar: lesbare.length,
    ohneDatum: lesbare.filter((e) => !e.datum).length,
    fehlgeschlagen: gescheitert.length,
    ersterFehler: gescheitert[0]?.grund ?? null,
  }
}

async function lesePlaylist(job: ExternalJob, repo: ExternalJobsRepository): Promise<void> {
  const optionen = lesePlaylistLesenOptionen(job)
  const playlist = await resolvePlaylistViaSecretary(optionen.url)
  const eintraege: LesenZeile[] = []
  for (const [index, e] of playlist.entries.entries()) {
    const basis = { position: e.position, id: e.id, titel: e.title, url: e.url }
    if (e.grund) {
      eintraege.push({ ...basis, datum: '', ordnerVorschlag: '', grund: `nicht abrufbar: ${e.grund}` })
      continue
    }
    try {
      const resolved = await resolveMediaViaSecretary(e.url)
      const datum = resolved.metadata?.uploadDate ?? ''
      const titel = resolved.title || e.title
      eintraege.push({ ...basis, titel, datum, ordnerVorschlag: ordnerVorschlag(e.position, titel, datum || undefined), grund: datum ? null : 'yt-dlp nennt kein Upload-Datum — Vorschlag nach Position' })
    } catch (error) {
      eintraege.push({ ...basis, datum: '', ordnerVorschlag: ordnerVorschlag(e.position, e.title), grund: error instanceof Error ? error.message : String(error), fehler: true })
    }
    await repo.pushLog(job.jobId, { phase: WEB_SOURCE_STEP, progress: Math.round(((index + 1) / playlist.entries.length) * 100), message: `${index + 1}/${playlist.entries.length} ${e.title}` })
  }
  const bilanz = playlistLesenBilanz(eintraege)
  const liste: PlaylistLesenEintrag[] = eintraege.map(({ position, id, titel, url, datum, ordnerVorschlag: vorschlag, grund }) => ({ position, id, titel, url, datum, ordnerVorschlag: vorschlag, grund }))
  await repo.appendMeta(job.jobId, { playlist: { url: playlist.url, title: playlist.title, uploader: playlist.uploader, anzahl: playlist.anzahl, ...bilanz, eintraege: liste } }, 'phase-web-source')
  // Alle lesbaren Eintraege gescheitert: der Lauf hat nichts gebracht — failed mit dem ersten Grund, nicht completed.
  if (bilanz.lesbar > 0 && bilanz.fehlgeschlagen === bilanz.lesbar) {
    throw new Error(`Kein einziges der ${bilanz.lesbar} Videos lesbar — erster Fehler: ${bilanz.ersterFehler ?? 'unbekannt'}`)
  }
  await repo.updateStep(job.jobId, WEB_SOURCE_STEP, { status: 'completed', endedAt: new Date(), details: { ...bilanz } })
}

export async function runWebSourcePhase(job: ExternalJob): Promise<void> {
  const repo = new ExternalJobsRepository()
  await repo.updateStep(job.jobId, WEB_SOURCE_STEP, { status: 'running', startedAt: new Date() })
  try {
    if (job.operation === WEB_SOURCE_OP_ERSCHLIESSEN) await erschliesseVideo(job, repo)
    else if (job.operation === WEB_SOURCE_OP_PLAYLIST_LESEN) await lesePlaylist(job, repo)
    else throw new Error(`web-source: unbekannte operation "${job.operation}"`)
    await repo.setStatus(job.jobId, 'completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await repo.updateStep(job.jobId, WEB_SOURCE_STEP, { status: 'failed', endedAt: new Date(), error: { message } })
    await repo.setStatus(job.jobId, 'failed', { error: { code: 'web_source_failed', message } })
    throw error
  }
}
