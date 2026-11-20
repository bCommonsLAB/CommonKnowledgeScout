/**
 * @fileoverview MongoDB-Abfragen fuer die gerechte Platzvergabe je Library.
 *
 * @description
 * Liefert die beiden Eingaben fuer `pickNextLibrary` (siehe `fair-share.ts`):
 * je Library den aeltesten wartenden Job und die Zahl laufender Jobs — beides
 * nur im eigenen Worker-Pool. Liegt in einer eigenen Datei, damit das
 * Repository nicht weiter waechst.
 *
 * Kosten: Die Gruppierung liest alle wartenden Jobs des Pools. Sie laeuft aber
 * nur, wenn der Worker einen freien Platz hat (`countRunning() < concurrency`),
 * also etwa einmal je fertigem Job. `$match` + `$sort` traegt der bestehende
 * Index `status_pool_updatedAt`; ein neuer Index ist nicht noetig.
 *
 * Datenfehler (Nicht-String-libraryId, kaputte jobId, unlesbares updatedAt)
 * werden laut ins Log geschrieben — nie still uebergangen.
 *
 * @module external-jobs
 */

import type { Collection } from 'mongodb'
import { FileLogger } from '@/lib/debug/logger'
import type { ExternalJob } from '@/types/external-job'
import { toLibraryKey, type QueuedLibraryHead, type RunningLibraryCount } from './fair-share'

interface QueuedHeadRow {
  _id: unknown
  jobId: unknown
  oldestQueuedAt: unknown
}

interface RunningRow {
  _id: unknown
  running: number
}

function reportInvalid(field: string, raw: unknown, jobId?: string): void {
  FileLogger.error('jobs-worker', `Faire Platzvergabe: ungueltiges Feld "${field}" in external_jobs`, {
    wert: String(raw),
    ...(jobId ? { jobId } : {}),
  })
}

/** `updatedAt` liegt je nach Schreibweg als Date, ISO-String oder Zahl vor. */
function toDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw : null
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw)
    return Number.isFinite(d.getTime()) ? d : null
  }
  return null
}

/**
 * Je Library mit wartenden Jobs: der aelteste wartende Job (jobId + Zeitpunkt).
 */
export async function loadQueuedHeads(
  col: Collection<ExternalJob>,
  poolMatch: Record<string, unknown>,
): Promise<QueuedLibraryHead[]> {
  const rows = await col
    .aggregate<QueuedHeadRow>([
      { $match: { status: 'queued', ...poolMatch } },
      { $sort: { updatedAt: 1 } },
      { $group: { _id: '$libraryId', jobId: { $first: '$jobId' }, oldestQueuedAt: { $first: '$updatedAt' } } },
    ])
    .toArray()

  const heads: QueuedLibraryHead[] = []
  for (const row of rows) {
    if (typeof row.jobId !== 'string' || row.jobId.length === 0) {
      // Ohne jobId kann weder die Start-Route noch der Claim den Job treffen.
      reportInvalid('jobId', row.jobId)
      continue
    }
    const jobId = row.jobId
    const libraryId = toLibraryKey(row._id, (raw) => reportInvalid('libraryId', raw, jobId))
    let oldestQueuedAt = toDate(row.oldestQueuedAt)
    if (!oldestQueuedAt) {
      // Ausdruecklich: als „wartet am laengsten" werten, damit die Library nicht
      // verhungert — ihr Kopf bliebe sonst fuer immer derselbe kaputte Job.
      // Der Claim setzt updatedAt danach neu.
      reportInvalid('updatedAt', row.oldestQueuedAt, jobId)
      oldestQueuedAt = new Date(0)
    }
    heads.push({ libraryId, jobId, oldestQueuedAt })
  }
  return heads
}

/** Zahl laufender Jobs je Library im eigenen Worker-Pool. */
export async function loadRunningCounts(
  col: Collection<ExternalJob>,
  poolMatch: Record<string, unknown>,
): Promise<RunningLibraryCount[]> {
  const rows = await col
    .aggregate<RunningRow>([
      { $match: { status: 'running', ...poolMatch } },
      { $group: { _id: '$libraryId', running: { $sum: 1 } } },
    ])
    .toArray()

  return rows.map((row) => ({
    libraryId: toLibraryKey(row._id, (raw) => reportInvalid('libraryId', raw)),
    running: row.running,
  }))
}
