/**
 * @fileoverview Helfer zum Anlegen eines Overlap-Bericht-Jobs (Stufe 3).
 *
 * @description
 * Wird von `POST /api/library/[libraryId]/overlap-report/recompute` aufgerufen.
 * Erzeugt EINEN External Job (`job_type: 'overlap-report'`, `operation:
 * 'recompute'`, `phase: 'phase-overlap-report'`). Der Worker pollt
 * `queued`-Jobs, ruft `/start`, das frueh in `runOverlapReportPhase`
 * verzweigt (ADR 0001, Domaene external-jobs). Route bleibt schmal.
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export interface EnqueueOverlapReportArgs {
  libraryId: string
  userEmail: string
  /** LLM-Modell (Default in der Phase: gpt-4.1-mini). */
  model?: string
  /** Aktive Galerie-Facetten-Filter — grenzen den analysierten Bestand ein. */
  filters?: Record<string, string[]>
  /** Obergrenze analysierter Massnahmen (Phase cappt hart auf 300). */
  maxMeasures?: number
  /** Bericht-Vorlage (Vorlagenverwaltung); fehlt sie -> eingebauter Default. */
  reportTemplateId?: string
}

export interface EnqueueOverlapReportResult {
  jobId: string
  jobSecret: string
}

export async function enqueueOverlapReportJob(
  args: EnqueueOverlapReportArgs,
): Promise<EnqueueOverlapReportResult> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)

  const job: ExternalJob = {
    jobId,
    jobSecretHash,
    job_type: 'overlap-report',
    operation: 'recompute',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: {
        name: 'Wirkungsbericht (LLM)',
        mediaType: 'overlap-report',
      },
      options: {
        phase: 'phase-overlap-report',
        model: args.model,
        filters: args.filters && Object.keys(args.filters).length > 0 ? args.filters : undefined,
        maxMeasures: args.maxMeasures,
        reportTemplateId: args.reportTemplateId,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [{ name: 'phase-overlap-report', status: 'pending' }],
    parameters: { model: args.model, maxMeasures: args.maxMeasures },
  }

  await repo.create(job)
  return { jobId, jobSecret }
}
