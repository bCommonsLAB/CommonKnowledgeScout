/**
 * @fileoverview Image-Analyzer Orphan-Guard
 *
 * @description
 * Verhindert doppelte Vision-API-Aufrufe an den Secretary, wenn der
 * CKS-Worker einen Image-Job nach 60s Worker-Timeout requeued, obwohl die
 * urspruengliche `/start`-Route-Instanz im Server-Prozess noch laeuft und
 * weiter mit dem Vision-Modell spricht.
 *
 * Hintergrund (siehe Diagnose im Chat 2026-04-28):
 *
 *   1. Worker triggert `/start` (queued -> running, Vision-Call beginnt).
 *   2. Worker-Fetch-Timeout (Default 60s, JOBS_WORKER_START_TIMEOUT_MS) feuert.
 *      Der Worker-AbortController bricht NUR den Worker→Start-Fetch ab,
 *      NICHT den Vision-Call im Server-Prozess. Server-Prozess laeuft weiter.
 *   3. Worker `requeueAfterStartFailure` setzt status zurueck auf `queued`,
 *      sofern attempts < maxAttempts (Default 3).
 *   4. Naechster Worker-Tick claimt den Job erneut, ruft `/start` ein zweites
 *      Mal — Vorgaenger-Instanz laeuft parallel weiter. Bis zu 3x.
 *
 * Resultat: 2-3 voll bezahlte Vision-Calls pro Job (jeweils 100-180s).
 *
 * Schutz hier (lokal, NUR im Image-Pfad — bewusst kein Repository-Refactor):
 *
 *   - Vor dem zweiten `repo.updateStep('transform_template', running)` und
 *     vor dem `callImageAnalyzerTemplate` einmal in Mongo nachsehen, ob
 *     der `transform_template`-Step BEREITS `running` ist und sein
 *     `startedAt` jung genug fuer einen plausibel laufenden Vision-Call.
 *   - Wenn ja: Caller bekommt `{ shouldSkip: true, ... }` und gibt sofort
 *     einen 200-Skip-Response an den Worker zurueck (kein zweiter Vision-Call).
 *   - Die Vorgaenger-Instanz schreibt am Ende ganz normal `setJobCompleted`
 *     und das `job_update`-SSE-Event. Der Worker vergisst diesen Tick.
 *
 * Race-Hinweis (akzeptiert):
 *
 *   Theoretisch koennen zwei `/start`-Aufrufe innerhalb weniger Millisekunden
 *   beide den Step noch nicht als `running` sehen und beide weiterlaufen.
 *   In der Praxis sind die Tick-Abstaende >= 2s (Worker-Polling-Intervall),
 *   und der erste `/start`-Aufruf setzt den Step typischerweise innerhalb von
 *   ~1.5s nach Beginn. Dieser Restrace ist deutlich kleiner als das Original-
 *   problem (3 voll bezahlte Calls) und kann spaeter mit einer atomaren
 *   `claimStep`-Methode geschlossen werden, falls noetig.
 *
 * @module external-jobs/image-analyzer-orphan-guard
 */

import type { ExternalJobsRepository } from '@/lib/external-jobs-repository'

/**
 * Maximale Lebensdauer eines `running`-Step, ab der wir nicht mehr von einer
 * lebenden Vorgaenger-Instanz ausgehen, sondern einen echten Hang vermuten.
 *
 * Wert (10 min) deckt:
 *   - Single-Image-Calls (Default-Timeout: 120s)
 *   - Composite-Multi-Calls (Default-Timeout: 240s)
 *   - Plus Puffer fuer Storage-Loading + Provider-Latenz
 *
 * Nach 10 min wird der Job ohnehin vom Watchdog (`startWatchdog`, ebenfalls
 * 600_000ms in `external-jobs-worker.ts` Z. ~244) auf `failed` gesetzt.
 * Wenn ein Step laenger als 10 min `running` bleibt, ist die Vorgaenger-
 * Instanz mit hoher Wahrscheinlichkeit gestorben, und ein neuer Versuch
 * ist legitim.
 */
const STALE_RUNNING_THRESHOLD_MS = 10 * 60 * 1000

export interface OrphanGuardResult {
  /** True, wenn der Caller den weiteren Vision-Call NICHT ausfuehren soll. */
  shouldSkip: boolean
  /** Diagnose: Wie alt war der bereits laufende Step? (nur wenn shouldSkip=true) */
  stepRunningSinceMs?: number
  /** Diagnose: Welcher Step war es? (z.B. 'transform_template') */
  stepName?: string
}

/**
 * Prueft, ob fuer `jobId` bereits eine andere Vision-Call-Instanz aktiv ist.
 *
 * Aufrufer:
 *   - `src/app/api/external/jobs/[jobId]/start/route.ts` (Single-Image-Pfad)
 *   - `src/lib/external-jobs/run-composite-multi-image.ts` (Multi-Image-Pfad)
 *
 * Aufruf direkt VOR `repo.updateStep('transform_template', { status: 'running', ... })`
 * und VOR `callImageAnalyzerTemplate(...)`.
 *
 * @param repo Externe-Jobs-Repository-Instanz (bereits in der Route vorhanden).
 * @param jobId Die Job-ID, die gerade verarbeitet werden soll.
 * @param stepName Name des Steps, der den Vision-Call kapselt.
 *                 Default: `'transform_template'` (gilt fuer beide Image-Pfade).
 * @returns OrphanGuardResult — `shouldSkip: true` heisst: Caller soll abbrechen.
 *
 * Robustheit:
 *   - Bei Mongo-Fehler oder fehlendem Job geben wir `shouldSkip: false` zurueck.
 *     Das ist die sichere Wahl — wir blockieren keinen legitimen Job, falls
 *     das Repo kurzzeitig nicht erreichbar ist. (no-silent-fallbacks gilt:
 *     ein Fehler im Guard darf keinen legitimen Lauf blockieren.)
 *   - Steps ohne `startedAt` werden ignoriert (zaehlen nicht als Orphan).
 */
export async function checkImageAnalyzerOrphan(
  repo: ExternalJobsRepository,
  jobId: string,
  stepName: string = 'transform_template'
): Promise<OrphanGuardResult> {
  let job
  try {
    job = await repo.get(jobId)
  } catch {
    // Mongo-Fehler darf den Job nicht blockieren — wir lassen weiterlaufen.
    return { shouldSkip: false }
  }
  if (!job?.steps) return { shouldSkip: false }

  const step = job.steps.find(s => s.name === stepName)
  if (!step || step.status !== 'running' || !step.startedAt) {
    return { shouldSkip: false }
  }

  const startedAtMs = step.startedAt instanceof Date
    ? step.startedAt.getTime()
    : new Date(step.startedAt).getTime()
  if (!Number.isFinite(startedAtMs)) return { shouldSkip: false }

  const ageMs = Date.now() - startedAtMs
  if (ageMs >= STALE_RUNNING_THRESHOLD_MS) {
    // Step ist zu alt — vermutlich Hang oder verlorene Instanz.
    // Der neue Aufruf ist legitim, kein Skip.
    return { shouldSkip: false }
  }

  return {
    shouldSkip: true,
    stepRunningSinceMs: ageMs,
    stepName,
  }
}
