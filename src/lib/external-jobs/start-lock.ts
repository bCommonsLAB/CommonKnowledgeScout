/**
 * @fileoverview Start-Sperre der `/start`-Route — ein Job laeuft nur einmal.
 *
 * @description
 * Befund 11.10.2026 (lokal und Prod): Der Worker brach sein Warten auf die
 * synchron arbeitende Start-Route ab, reihte den Job neu ein und startete ihn
 * parallel ein zweites Mal — doppelte LLM-Kosten, Artefakt doppelt geschrieben,
 * Endstatus „failed" trotz fertigem Ergebnis. Die Route erkannte den zweiten
 * Start zwar (`checkJobStartability`), loggte ihn aber nur.
 *
 * Die Sperre ist ein Feld am Job-Dokument, atomar gesetzt. Frei ist sie, wenn
 * sie fehlt — oder der Job `failed` ist, denn fehlgeschlagene Jobs duerfen
 * neu gestartet werden (Werkbank „Erneut starten"). Sie wird nicht geloest:
 * Ein beendeter Job wird nicht noch einmal gestartet; dafuer legt die
 * Pipeline einen neuen Job an.
 *
 * @module external-jobs
 */

import type { Filter } from 'mongodb'
import type { ExternalJob } from '@/types/external-job'

export interface StartLock {
  startRequestId: string | null
  workerId: string | null
  pid: number
  at: Date
}

/** Dokument-Filter, unter dem die Sperre gesetzt werden darf. */
export function startLockFreiFilter(jobId: string): Filter<ExternalJob> {
  return { jobId, $or: [{ startLock: { $exists: false } }, { status: 'failed' }] }
}

export function neueStartLock(args: { startRequestId: string | null; workerId: string | null; pid: number }): StartLock {
  return { ...args, at: new Date() }
}
