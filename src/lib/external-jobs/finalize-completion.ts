/**
 * @fileoverview Gemeinsamer Job-Abschluss (Normal- UND Extract-Only-Pfad).
 *
 * @description
 * EINE Quelle für den Abschluss eines External Jobs. Vorher gab es zwei
 * auseinandergedriftete Pfade: `setJobCompleted` (Template-/Ingest-Pfad) und der
 * Extract-Only-Kurzschluss in `runExtractOnly`. Nur der erste rief den
 * Submission-Rückfluss (`applyAnalysisResult`) auf — deshalb fehlte bei „Nur
 * importieren und transkribieren" (5a) das Transkript in der Submission.
 *
 * Diese Funktion vereinheitlicht den Abschluss-Tail beider Pfade:
 *  1. Submission-Rückfluss (nur wenn korreliert) — BEWUSST vor `completed`, ohne
 *     `catch`: schlägt der Rückfluss fehl, darf der Job NICHT `completed` melden
 *     (Retry statt stillem Teilzustand).
 *  2. `setResult` (erst Result, dann Status → kein Polling-Race).
 *  3. `setStatus('completed')`.
 *  4. Logs drainen + Watchdog stoppen.
 *  5. SSE-Event für die UI.
 *
 * Die Contract-Validierung des `savedItemId` bleibt im Aufrufer (`complete.ts`),
 * da sie nur den Template-/Ingest-Pfad betrifft.
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer'
import { applyAnalysisResult, extractSubmissionIdFromJob } from '@/lib/submissions/submission-analysis'
import { clearWatchdog } from '@/lib/external-jobs-watchdog'
import { buildProvider } from '@/lib/external-jobs/provider'
import { getJobEventBus } from '@/lib/events/job-event-bus'

/** Eingaben für den gemeinsamen Abschluss. */
export interface FinalizeJobCompletionArgs {
  repo: ExternalJobsRepository
  jobId: string
  /** Persistiertes Job-Dokument (für userEmail, providerScope, correlation, job_type). */
  job: ExternalJob
  /**
   * Validierte Artefakt-ID (Transkript bzw. Transformation). Kann im Extract-Only-
   * Pfad `undefined` sein (z.B. kein extrahierter Text). Für korrelierte
   * Submission-Jobs ist sie Pflicht — sonst gibt es nichts zurückzufließen.
   */
  savedItemId: string | undefined
  /** Payload-Daten für `setResult` (erstes Argument). */
  payload: ExternalJob['payload']
  /** Ergebnis-Referenzen für `setResult` (zweites Argument). */
  resultRefs: ExternalJob['result']
}

/**
 * Schließt einen Job einheitlich ab. Wird von `setJobCompleted` (Normalpfad)
 * und `runExtractOnly` (Extract-Only-Pfad) genutzt, damit der Submission-
 * Rückfluss in EINEM Pfad lebt (keine Dopplung, keine Drift).
 */
export async function finalizeJobCompletion(args: FinalizeJobCompletionArgs): Promise<void> {
  const { repo, jobId, job, savedItemId, payload, resultRefs } = args

  // 1) Submission-Rückfluss VOR `completed` (Retry-Invariante): nur wenn der Job
  //    mit einer Inbox-Submission korreliert ist (sonst normaler Archiv-Job).
  const submissionId = extractSubmissionIdFromJob(job)
  if (submissionId) {
    // Kein stiller leerer Abschluss: Eine Submission-Analyse ohne Artefakt ist ein
    // echter Fehler (z.B. Transkript leer). Laut fehlschlagen → Retry/Sichtbarkeit,
    // statt eine leere Submission zu publizieren.
    if (!savedItemId) {
      throw new Error(
        `finalizeJobCompletion: Submission-Analyse ${submissionId} ohne Artefakt (savedItemId fehlt) – kein Rueckfluss moeglich.`,
      )
    }
    const provider = await buildProvider({
      userEmail: job.userEmail,
      libraryId: job.libraryId,
      jobId,
      repo,
      providerScope: job.providerScope,
    })
    await applyAnalysisResult({ submissionId, savedItemId, provider })
    bufferLog(jobId, {
      phase: 'submission_result_applied',
      message: `Analyse-Ergebnis in Submission ${submissionId} uebernommen`,
    })
  }

  // 2) + 3) Erst Result persistieren, dann Status auf completed (kein Race).
  await repo.setResult(jobId, payload, resultRefs)
  await repo.setStatus(jobId, 'completed')

  // 4) Logs drainen (keine Replays) + Watchdog stoppen.
  void drainBufferedLogs(jobId)
  try {
    clearWatchdog(jobId)
  } catch (error) {
    // Watchdog-Fehler nicht kritisch - Job ist bereits abgeschlossen.
    console.warn('[finalizeJobCompletion] Fehler beim Stoppen des Watchdogs', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 5) SSE-Event für die UI-Aktualisierung.
  try {
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'completed',
      progress: 100,
      updatedAt: new Date().toISOString(),
      message: 'completed',
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
      sourceItemId: job.correlation?.source?.itemId,
      result: { savedItemId },
    })
  } catch {
    // SSE-Fehler nicht kritisch - Job ist bereits abgeschlossen.
  }
}
