/**
 * @fileoverview Vorbedingung „die Route hat den Job noch nicht angefasst" (Welle I2).
 *
 * @description
 * Der Text-Feed darf einen Job nur dann auf `failed` setzen, wenn die
 * Callback-Route nie mit ihm gearbeitet hat. Hat sie einen Schritt gestartet,
 * abgeschlossen oder scheitern lassen, gehoert der Endstatus ihr — ein
 * Feed-Fehler (Zeitablauf, abgerissene Verbindung) ist dann nur ein Ereignis
 * im Trace. Befund 11.10.2026: `failed` ueber einem Job, dessen Ingest
 * fertig war; danach „Abschluss verweigert" in `finalize-completion.ts`.
 *
 * Der Filter ist reine Daten (unit-testbar); das Repository legt ihn auf die
 * Collection.
 *
 * @module external-jobs
 */

import type { ExternalJobStep } from '@/types/external-job'

/** Schritt-Status, die beweisen, dass die Route gearbeitet hat. */
export const SCHRITT_IN_ARBEIT: ReadonlyArray<ExternalJobStep['status']> = ['running', 'completed', 'failed']

/**
 * Mongo-Filter: Job laeuft (so legt ihn `buildTemplateOnTextJob` an) und
 * kein Schritt ist ueber `pending` hinaus. Fehlt `steps` ganz, gilt der Job
 * ebenfalls als unberuehrt.
 */
export function unberuehrtFilter(jobId: string): Record<string, unknown> {
  return {
    jobId,
    status: 'running',
    steps: { $not: { $elemMatch: { status: { $in: [...SCHRITT_IN_ARBEIT] } } } },
  }
}

/** Dieselbe Regel auf einem geladenen Dokument — fuer Tests und Sichten. */
export function istUnberuehrt(job: { status: string; steps?: ExternalJobStep[] }): boolean {
  if (job.status !== 'running') return false
  return !(job.steps ?? []).some((step) => SCHRITT_IN_ARBEIT.includes(step.status))
}
