/**
 * @fileoverview Helfer zum Anlegen eines Similarity-Persist-Jobs (Stufe 4c).
 *
 * @description
 * Wird von `POST /api/library/[libraryId]/doc-similarity/recompute` aufgerufen.
 * Erzeugt EINEN External Job (`job_type: 'doc-similarity'`, `operation:
 * 'recompute'`, `phase: 'phase-doc-similarity'`). Der Worker pollt `queued`-
 * Jobs, ruft `/start`, das frueh in `runDocSimilarityPhase` verzweigt
 * (ADR 0001, Domaene external-jobs), analog phase-doc-relations/overlap-report.
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export interface EnqueueDocSimilarityResult {
  jobId: string
  jobSecret: string
}

export async function enqueueDocSimilarityJob(args: {
  libraryId: string
  userEmail: string
}): Promise<EnqueueDocSimilarityResult> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)

  const job: ExternalJob = {
    jobId,
    jobSecretHash,
    job_type: 'doc-similarity',
    operation: 'recompute',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: { name: 'Aehnlichkeits-Nachbarn', mediaType: 'doc-similarity' },
      options: { phase: 'phase-doc-similarity' },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [{ name: 'phase-doc-similarity', status: 'pending' }],
    parameters: {},
  }

  await repo.create(job)
  return { jobId, jobSecret }
}
