/**
 * @fileoverview Webseiten-/Playlist-Jobs einreihen (Welle K3, `playlist_erschliessen`).
 *
 * @description
 * Ein Video-Download dauert bis zu 15 Minuten; die 60-Sekunden-Grenze der
 * Bruecke laesst das nicht synchron zu. Darum je Video EIN Job
 * (`job_type: 'web-source'`, `operation: 'erschliessen'`), den der Worker
 * ueber `/start` anstoesst; die Start-Route verzweigt frueh in
 * `phase-web-source` (ADR 0001, wie golden-set) und antwortet 202, die Phase
 * ruft `webseiteErschliessen` fuer den Ordner des Videos und schreibt Stand
 * und Ergebnis selbst. Alle Jobs eines Aufrufs tragen dieselbe `batchId`,
 * ebenso die Transkriptions-Jobs, die die Phase startet — `batch_bilanz`
 * sieht den ganzen Stapel. Zweite Form: `operation: 'playlist-lesen'` holt
 * je Video die Metadaten (Upload-Datum) fuer Ordnernamen `JJJJ-MM-TT Titel`.
 * Reine Builder, unit-testbar; kaputte Jobs fallen laut, nicht mit Defaults.
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export const WEB_SOURCE_JOB_TYPE = 'web-source'
export const WEB_SOURCE_OP_ERSCHLIESSEN = 'erschliessen'
export const WEB_SOURCE_OP_PLAYLIST_LESEN = 'playlist-lesen'
export const WEB_SOURCE_STEP = 'web_source'

type EnqueueJob = Omit<ExternalJob, 'createdAt' | 'updatedAt'>

export interface WebSourceJobOptionen {
  url: string
  /** Ordner des Videos (dort entstehen Sammeldatei, Tonspur, Cover). */
  folderId: string
  /** Wurzel, unter der der Ordner liegt. */
  wurzelId: string
  ordner: string
  dateiname: string
  targetLanguage: string
  audioContext: Record<string, unknown>
  llmModel?: string
  medienEinbetten: boolean
  position: number
  titel: string
}

export interface PlaylistLesenOptionen {
  url: string
  wurzelId: string
  titel: string
}

export interface Batch {
  batchId: string
  batchName: string
}

export function buildWebSourceJob(args: { jobId: string; jobSecretHash: string; libraryId: string; userEmail: string; optionen: WebSourceJobOptionen; batch: Batch }): EnqueueJob {
  const { optionen, batch } = args
  if (!optionen.url.trim() || !optionen.folderId.trim() || !/\.md$/i.test(optionen.dateiname)) {
    throw new Error('web-source-Job braucht url, folderId und einen dateiname auf .md')
  }
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: WEB_SOURCE_JOB_TYPE,
    operation: WEB_SOURCE_OP_ERSCHLIESSEN,
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: { itemId: optionen.folderId, parentId: optionen.wurzelId, name: `${optionen.ordner}/${optionen.dateiname}`, mediaType: 'web-source', mimeType: 'text/markdown' },
      options: { ...optionen },
      batchId: batch.batchId,
      batchName: batch.batchName,
    },
    steps: [{ name: WEB_SOURCE_STEP, status: 'pending' }],
    parameters: { phase: 'phase-web-source', position: optionen.position, titel: optionen.titel },
  }
}

export function buildPlaylistLesenJob(args: { jobId: string; jobSecretHash: string; libraryId: string; userEmail: string; optionen: PlaylistLesenOptionen }): EnqueueJob {
  const { optionen } = args
  if (!optionen.url.trim() || !optionen.wurzelId.trim()) throw new Error('playlist-lesen-Job braucht url und wurzelId')
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: WEB_SOURCE_JOB_TYPE,
    operation: WEB_SOURCE_OP_PLAYLIST_LESEN,
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: { itemId: optionen.wurzelId, parentId: optionen.wurzelId, name: `Playlist: ${optionen.titel}`, mediaType: 'playlist' },
      options: { ...optionen },
    },
    steps: [{ name: WEB_SOURCE_STEP, status: 'pending' }],
    parameters: { phase: 'phase-web-source', titel: optionen.titel },
  }
}

function neueIdentitaet(repo: ExternalJobsRepository): { jobId: string; jobSecretHash: string } {
  return { jobId: crypto.randomUUID(), jobSecretHash: repo.hashSecret(crypto.randomBytes(24).toString('base64url')) }
}

export async function enqueueWebSourceJob(args: { libraryId: string; userEmail: string; optionen: WebSourceJobOptionen; batch: Batch }): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const identitaet = neueIdentitaet(repo)
  await repo.create(buildWebSourceJob({ ...args, ...identitaet }))
  return { jobId: identitaet.jobId }
}

export async function enqueuePlaylistLesenJob(args: { libraryId: string; userEmail: string; optionen: PlaylistLesenOptionen }): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const identitaet = neueIdentitaet(repo)
  await repo.create(buildPlaylistLesenJob({ ...args, ...identitaet }))
  return { jobId: identitaet.jobId }
}

function pflichtText(o: Record<string, unknown>, feld: string, jobArt: string): string {
  const v = o[feld]
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${jobArt}-Job ohne ${feld}`)
  return v
}

/** Optionen typgeprueft aus dem Job lesen. */
export function leseWebSourceOptionen(job: ExternalJob): WebSourceJobOptionen {
  const o = (job.correlation?.options ?? {}) as Record<string, unknown>
  const audioContext = o['audioContext']
  return {
    url: pflichtText(o, 'url', 'web-source'),
    folderId: pflichtText(o, 'folderId', 'web-source'),
    wurzelId: pflichtText(o, 'wurzelId', 'web-source'),
    ordner: pflichtText(o, 'ordner', 'web-source'),
    dateiname: pflichtText(o, 'dateiname', 'web-source'),
    targetLanguage: pflichtText(o, 'targetLanguage', 'web-source'),
    audioContext: audioContext && typeof audioContext === 'object' && !Array.isArray(audioContext) ? (audioContext as Record<string, unknown>) : {},
    ...(typeof o['llmModel'] === 'string' && o['llmModel'] ? { llmModel: o['llmModel'] } : {}),
    medienEinbetten: o['medienEinbetten'] !== false,
    position: typeof o['position'] === 'number' ? o['position'] : 0,
    titel: typeof o['titel'] === 'string' ? o['titel'] : '',
  }
}

export function lesePlaylistLesenOptionen(job: ExternalJob): PlaylistLesenOptionen {
  const o = (job.correlation?.options ?? {}) as Record<string, unknown>
  return { url: pflichtText(o, 'url', 'playlist-lesen'), wurzelId: pflichtText(o, 'wurzelId', 'playlist-lesen'), titel: typeof o['titel'] === 'string' ? o['titel'] : '' }
}
