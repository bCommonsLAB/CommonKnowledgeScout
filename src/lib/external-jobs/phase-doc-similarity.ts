/**
 * @fileoverview External-Job Phase: phase-doc-similarity (Stufe 4c).
 *
 * @description
 * Deterministischer Lauf (kein LLM, ADR 0001): rechnet je Dokument die Top-K
 * semantischen Nachbarn per Vector-Suche und persistiert sie flach nach
 * `docMetaJson.similarity_neighbors` (+ `similarity_stand`). Danach baut der
 * Graph die Similarity-Kanten aus den geladenen Docs OHNE Live-Vector-Suche.
 *
 * Fortschritt wird als Trace-Event getract (Job-Monitor-Panel).
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LibraryService } from '@/lib/services/library-service'
import { computeAndStoreSimilarityNeighbors } from '@/lib/graph/similarity-persist'
import type { ExternalJob } from '@/types/external-job'

export interface DocSimilarityPhaseResult {
  processed: number
  missingEmbeddings: number
  failedSeeds: number
  topK: number
}

export async function runDocSimilarityPhase(job: ExternalJob): Promise<DocSimilarityPhaseResult> {
  const repo = new ExternalJobsRepository()
  await repo.updateStep(job.jobId, 'phase-doc-similarity', { status: 'running', startedAt: new Date() })

  const library = await LibraryService.getInstance().getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-doc-similarity: Library nicht gefunden')

  let lastTraced = 0
  const result = await computeAndStoreSimilarityNeighbors(library, job.libraryId, async (done, total) => {
    // Nicht jeden Batch tracen — nur bei spuerbarem Fortschritt (Mongo schonen).
    if (done - lastTraced >= 200 || done === total) {
      lastTraced = done
      await repo.traceAddEvent(job.jobId, {
        spanId: 'phase-doc-similarity', name: 'similarity_progress', level: 'info',
        attributes: { done, total },
      }).catch(() => {})
    }
  })

  await repo.traceAddEvent(job.jobId, {
    spanId: 'phase-doc-similarity', name: 'similarity_computed', level: 'info',
    attributes: { ...result },
  }).catch(() => {})

  await repo.updateStep(job.jobId, 'phase-doc-similarity', {
    status: 'completed', endedAt: new Date(),
    details: { processed: result.processed, missingEmbeddings: result.missingEmbeddings, failedSeeds: result.failedSeeds },
  })
  await repo.setStatus(job.jobId, 'completed')
  return {
    processed: result.processed, missingEmbeddings: result.missingEmbeddings,
    failedSeeds: result.failedSeeds, topK: result.topK,
  }
}
