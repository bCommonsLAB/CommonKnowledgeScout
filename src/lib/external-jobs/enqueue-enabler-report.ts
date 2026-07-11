/**
 * @fileoverview Helfer zum Anlegen eines Enabler-Bericht-Jobs (Stufe 4b,
 * template-getrieben seit 2026-07-11 — mit LLM-Prosa-Pass daher external-job
 * statt synchroner Route, analog enqueue-overlap-report).
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export interface EnqueueEnablerReportArgs {
  libraryId: string
  userEmail: string
  /** LLM-Modell fuer den Prosa-Pass. */
  model?: string
  /** Bericht-Vorlage; sonst Library-Kopie 'bericht-enabler' bzw. Builtin. */
  reportTemplateId?: string
}

export interface EnqueueEnablerReportResult {
  jobId: string
  jobSecret: string
}

export async function enqueueEnablerReportJob(
  args: EnqueueEnablerReportArgs,
): Promise<EnqueueEnablerReportResult> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)

  const job: ExternalJob = {
    jobId,
    jobSecretHash,
    job_type: 'enabler-report',
    operation: 'recompute',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: {
        name: 'Enabler-Bericht',
        mediaType: 'enabler-report',
      },
      options: {
        phase: 'phase-enabler-report',
        model: args.model,
        reportTemplateId: args.reportTemplateId,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [{ name: 'phase-enabler-report', status: 'pending' }],
    parameters: { model: args.model },
  }

  await repo.create(job)
  return { jobId, jobSecret }
}
