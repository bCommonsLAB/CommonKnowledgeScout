/**
 * @fileoverview Playlist ueber die Bruecke erschliessen: Vorschau und Anlegen (Welle K3).
 *
 * @description
 * Dieselbe Service-Funktion fuer die Bruecke (`playlist_erschliessen`) und
 * eine spaetere UI-Route (ADR 0007). Zwei Stufen wie bei einer Veranstaltung:
 * - `playlistVorschau` liest nur: flache Liste mit Position, Titel, Dauer,
 *   Adresse und vorgeschlagenem Ordnernamen; mit `mitDatum` startet sie einen
 *   Lesejob, der je Video das Upload-Datum holt (Ergebnis ueber job_status).
 * - `playlistAnlegen` schreibt: je gewaehltem Video einen Ordner unter der
 *   Wurzel und EINEN Job, der dort Sammeldatei, Tonspur und Cover anlegt und
 *   die Transkription startet (`phase-web-source`). Antwort sofort mit
 *   batchId; Fortschritt ueber batch_bilanz, Wiederholung ueber batch_neustart.
 *   Vorhandene Ordner werden nicht ueberschrieben (Befund je Zeile), ein
 *   Fehler einer Zeile bricht den Stapel nicht ab.
 *
 * @module web-source
 */

import crypto from 'crypto'
import { enqueuePlaylistLesenJob, enqueueWebSourceJob } from '@/lib/external-jobs/enqueue-web-source'
import type { StorageProvider } from '@/lib/storage/types'
import { ordnerVorschlag, planePlaylistAnlage, type PlaylistZeilePlan } from './playlist-auswahl'
import { resolvePlaylistViaSecretary, type ResolvedPlaylist } from './playlist-resolve'

export interface PlaylistKopf {
  url: string
  title: string
  uploader: string
  description: string
  anzahl: number
  nichtAbrufbar: number
}

export interface VorschauEintrag {
  position: number
  id: string
  url: string
  titel: string
  dauerSekunden: number | null
  ordnerVorschlag: string
  grund: string | null
}

export interface PlaylistVorschauResult {
  playlist: PlaylistKopf
  eintraege: VorschauEintrag[]
  /** Lesejob fuer Ordnernamen mit Datum (nur mit mitDatum). */
  datumJob: { jobId: string } | null
}

function kopf(p: ResolvedPlaylist): PlaylistKopf {
  return { url: p.url, title: p.title, uploader: p.uploader, description: p.description, anzahl: p.anzahl, nichtAbrufbar: p.entries.filter((e) => e.grund).length }
}

export async function playlistVorschau(args: { libraryId: string; userEmail: string; url: string; mitDatum: boolean; wurzelId?: string }): Promise<PlaylistVorschauResult> {
  const playlist = await resolvePlaylistViaSecretary(args.url)
  const eintraege: VorschauEintrag[] = playlist.entries.map((e) => ({
    position: e.position, id: e.id, url: e.url, titel: e.title, dauerSekunden: e.duration,
    ordnerVorschlag: e.grund ? '' : ordnerVorschlag(e.position, e.title), grund: e.grund,
  }))
  let datumJob: { jobId: string } | null = null
  if (args.mitDatum) {
    if (!args.wurzelId) throw new Error('mitDatum braucht ordner oder ordnerId (die Wurzel, unter der die Ordner entstehen)')
    datumJob = await enqueuePlaylistLesenJob({ libraryId: args.libraryId, userEmail: args.userEmail, optionen: { url: args.url, wurzelId: args.wurzelId, titel: playlist.title } })
  }
  return { playlist: kopf(playlist), eintraege, datumJob }
}

export interface PlaylistAnlegenInput {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  url: string
  wurzelId: string
  auswahl: ReadonlyArray<number | string>
  ordnernamen?: Record<string, string>
  targetLanguage: string
  audioContext: Record<string, unknown>
  llmModel?: string
  medienEinbetten: boolean
}

export interface AnlegenZeile extends Omit<PlaylistZeilePlan, 'url'> {
  ordnerId: string | null
  jobId: string | null
}

export interface PlaylistAnlegenResult {
  playlist: PlaylistKopf
  batchId: string
  batchName: string
  zeilen: AnlegenZeile[]
  gestartet: number
  nichtAngelegt: number
}

export async function playlistAnlegen(input: PlaylistAnlegenInput): Promise<PlaylistAnlegenResult> {
  const { libraryId, userEmail, provider, wurzelId } = input
  const playlist = await resolvePlaylistViaSecretary(input.url)
  const vorhandene = (await provider.listItemsById(wurzelId)).filter((i) => i.type === 'folder').map((i) => i.metadata.name)
  const plan = planePlaylistAnlage({ entries: playlist.entries, auswahl: input.auswahl, ordnernamen: input.ordnernamen, vorhandeneNamen: vorhandene })
  const batchId = crypto.randomUUID()
  const batchName = `Playlist: ${playlist.title || input.url}`
  const zeilen: AnlegenZeile[] = []
  for (const zeile of plan) {
    const { url, ...rest } = zeile
    if (zeile.befund) {
      zeilen.push({ ...rest, ordnerId: null, jobId: null })
      continue
    }
    try {
      const ordner = await provider.createFolder(wurzelId, zeile.ordner)
      const { jobId } = await enqueueWebSourceJob({
        libraryId, userEmail, batch: { batchId, batchName },
        optionen: {
          url, folderId: ordner.id, wurzelId, ordner: zeile.ordner, dateiname: `${zeile.ordner}.md`,
          targetLanguage: input.targetLanguage, audioContext: input.audioContext, llmModel: input.llmModel,
          medienEinbetten: input.medienEinbetten, position: zeile.position, titel: zeile.titel,
        },
      })
      zeilen.push({ ...rest, ordnerId: ordner.id, jobId })
    } catch (error) {
      zeilen.push({ ...rest, befund: error instanceof Error ? error.message : String(error), ordnerId: null, jobId: null })
    }
  }
  return {
    playlist: kopf(playlist), batchId, batchName, zeilen,
    gestartet: zeilen.filter((z) => z.jobId).length,
    nichtAngelegt: zeilen.filter((z) => z.befund).length,
  }
}
