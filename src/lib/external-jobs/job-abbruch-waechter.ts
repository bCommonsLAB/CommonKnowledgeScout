/**
 * @fileoverview Abbruch-Waechter: Vor dem Schreiben pruefen, ob der Job noch lebt.
 *
 * @description
 * Befund 23.09.2026 (commoning-methods, Library AECED): `job_abbrechen` setzt
 * den Status auf `failed`, aber kein Signal erreicht den laufenden Worker. Der
 * abgebrochene Job lief zu Ende, schrieb seine Transformation nach Mongo und
 * markierte sich am Schluss bedingungslos `completed`. Ein zweiter Job mit
 * anderer Vorlage veroeffentlichte dann DESSEN Ergebnis.
 *
 * Hier wird vor jedem Schreibschritt (Transformation speichern, Ingest,
 * Abschluss) der Status aus der Datenbank gelesen. Steht er auf `failed`, wird
 * NICHT geschrieben — und der Abbruchgrund von Hand bleibt stehen, weil der
 * Aufrufer keinen neuen Fehler darueberlegt (`handleJobError` wuerde ihn
 * ueberschreiben).
 *
 * @module external-jobs
 */

import type { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { FileLogger } from '@/lib/debug/logger'

/** Fehlercode, den `job_abbrechen` setzt — Quelle fuer alle, die ihn erkennen muessen. */
export const ABBRUCH_VON_HAND_CODE = 'von_hand_abgebrochen'

export type AbbruchPruefung =
  | { abgebrochen: false }
  | { abgebrochen: true; grund: string }

/** Nur die Repository-Methode, die der Waechter braucht (unit-testbar). */
export type AbbruchRepo = Pick<ExternalJobsRepository, 'get'>

/**
 * Liest den Job-Status. `failed` heisst: jemand hat den Job beendet — der
 * Aufrufer ueberspringt seinen Schreibschritt. Ein Job, der nicht mehr
 * existiert, gilt ebenfalls als abgebrochen (nichts, wohin man schreiben koennte).
 */
export async function pruefeJobNichtAbgebrochen(
  repo: AbbruchRepo,
  jobId: string,
  schritt: string,
): Promise<AbbruchPruefung> {
  const job = await repo.get(jobId)
  if (!job) {
    return { abgebrochen: true, grund: `Job ${jobId} existiert nicht mehr` }
  }
  if (job.status !== 'failed') return { abgebrochen: false }

  const grund = job.error?.message
    ? `Job wurde beendet (${job.error.code ?? 'failed'}): ${job.error.message}`
    : 'Job steht auf failed'
  bufferLog(jobId, { phase: `${schritt}_abgebrochen`, message: `${schritt} uebersprungen — ${grund}` })
  FileLogger.warn('job-abbruch-waechter', 'Schreibschritt uebersprungen: Job ist abgebrochen', {
    jobId, schritt, code: job.error?.code ?? null,
  })
  return { abgebrochen: true, grund }
}

/**
 * True, wenn der Job von Hand beendet wurde. Dann darf KEIN Fehlerbehandler
 * den Abbruchgrund durch seinen eigenen Fehler ersetzen — sonst steht am Job
 * `start_error: Abschluss verweigert …` statt des Grundes, den der Mensch
 * angegeben hat.
 */
export async function istVonHandAbgebrochen(repo: AbbruchRepo, jobId: string): Promise<boolean> {
  const job = await repo.get(jobId)
  return job?.status === 'failed' && job.error?.code === ABBRUCH_VON_HAND_CODE
}
