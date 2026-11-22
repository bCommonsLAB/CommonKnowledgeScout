/**
 * @fileoverview Helfer zum Anlegen eines Teppich-Jobs (Plan `teppich-der-dokumente`, T1).
 *
 * @description
 * Erzeugt EINEN External Job (`job_type: 'doc-teppich'`, `operation: 'recompute'`,
 * `phase: 'phase-doc-teppich'`). Der Worker pollt `queued`-Jobs, ruft `/start`,
 * das frueh in `runDocTeppichPhase` verzweigt (ADR 0001, Muster doc-similarity).
 *
 * @usedIn src/app/api/library/[libraryId]/doc-teppich/recompute/route.ts, src/lib/mcp/tools-teppich.ts
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export async function enqueueDocTeppichJob(args: { libraryId: string; userEmail: string }): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')

  const job: ExternalJob = {
    jobId,
    jobSecretHash: repo.hashSecret(jobSecret),
    job_type: 'doc-teppich',
    operation: 'recompute',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: { name: 'Teppich der Dokumente', mediaType: 'doc-teppich' },
      options: { phase: 'phase-doc-teppich' },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [{ name: 'phase-doc-teppich', status: 'pending' }],
    parameters: {},
  }

  await repo.create(job)
  return { jobId }
}
