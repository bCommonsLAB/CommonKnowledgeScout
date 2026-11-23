/**
 * @fileoverview External-Job Phase: phase-doc-teppich (Plan `teppich-der-dokumente`, T1).
 *
 * @description
 * Deterministischer Lauf (kein LLM, keine Vector-Suche, ADR 0001): rechnet die
 * festen Plaetze aller Dokumente und speichert sie flach in `docMetaJson`
 * (`teppich_x`, `teppich_y`, `teppich_gewicht`, `teppich_stand`). Grundlage sind
 * die Nachbarn aus `phase-doc-similarity`. Fortschritt und Zaehler gehen als
 * Trace-Events in den Job-Monitor.
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LibraryService } from '@/lib/services/library-service'
import { computeAndStoreTeppich, type TeppichPersistResult } from '@/lib/graph/teppich-persist'
import type { ExternalJob } from '@/types/external-job'

export async function runDocTeppichPhase(job: ExternalJob): Promise<TeppichPersistResult> {
  const repo = new ExternalJobsRepository()
  await repo.updateStep(job.jobId, 'phase-doc-teppich', { status: 'running', startedAt: new Date() })

  const library = await LibraryService.getInstance().getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-doc-teppich: Library nicht gefunden')

  const result = await computeAndStoreTeppich(library, job.libraryId, async (done, total) => {
    await repo.traceAddEvent(job.jobId, {
      spanId: 'phase-doc-teppich', name: 'teppich_progress', level: 'info',
      attributes: { done, total },
    }).catch(() => {})
  })

  await repo.traceAddEvent(job.jobId, {
    spanId: 'phase-doc-teppich', name: 'teppich_computed', level: 'info',
    attributes: { ...result },
  }).catch(() => {})

  await repo.updateStep(job.jobId, 'phase-doc-teppich', {
    status: 'completed', endedAt: new Date(),
    details: {
      dokumente: result.dokumente, geschrieben: result.geschrieben,
      ohneDatum: result.ohneDatum, ohneNachbarn: result.ohneNachbarn, ohneUmfang: result.ohneUmfang,
      ausgelassenWebsite: result.ausgelassenWebsite, ohneKennung: result.ohneKennung,
      wolkeKanten: result.wolkeKanten, wolkeSchritte: result.wolkeSchritte, wolkeMs: result.wolkeMs,
    },
  })
  await repo.setStatus(job.jobId, 'completed')
  return result
}
