/**
 * @fileoverview Helfer zum Anlegen eines Doc-Relations-Recompute-Jobs (Welle 4).
 *
 * @description
 * Wird von `POST /api/library/[libraryId]/doc-relations/recompute` aufgerufen.
 * Erzeugt EINEN External Job (`job_type: 'doc-relations'`, `operation:
 * 'recompute'`, `phase: 'phase-doc-relations'`). Der Worker pollt `queued`-Jobs,
 * ruft `/start`, das früh in `runDocRelationsPhase` verzweigt (ADR 0001,
 * Domäne `external-jobs`). Die Route selbst bleibt schmal: kein LLM-Call.
 *
 * @module external-jobs/enqueue-doc-relations
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export interface EnqueueDocRelationsArgs {
  libraryId: string
  userEmail: string
  /** `library` = ganzer Katalog, `source` = nur ausgehende Kanten einer Maßnahme. */
  scope: 'library' | 'source'
  /** Pflicht bei `scope: 'source'` — STABILE fileId der Maßnahme. */
  sourceFileId?: string
  /** Generischer Beziehungstyp (Default „unterstuetzt"). */
  relationType?: string
  /** Optionaler, library-spezifischer Zusatz-Prompt. */
  relationPrompt?: string
  /** Anzeige-Label im Job-Monitor-Panel. */
  sourceName?: string
}

export interface EnqueueDocRelationsResult {
  jobId: string
  jobSecret: string
}

export async function enqueueDocRelationsJob(
  args: EnqueueDocRelationsArgs,
): Promise<EnqueueDocRelationsResult> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)

  const label = args.scope === 'source'
    ? `Beziehungen: ${args.sourceName || args.sourceFileId || 'Maßnahme'}`
    : 'Beziehungen: ganze Bibliothek'

  const job: ExternalJob = {
    jobId,
    jobSecretHash,
    job_type: 'doc-relations',
    operation: 'recompute',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: {
        // itemId = sourceFileId (falls source-scope), damit die UI Jobs pro
        // Maßnahme finden kann; bei library-scope nur als Anzeige-Label.
        itemId: args.sourceFileId,
        name: label,
        mediaType: 'doc-relations',
      },
      options: {
        phase: 'phase-doc-relations',
        scope: args.scope,
        sourceFileId: args.sourceFileId,
        relationType: args.relationType,
        relationPrompt: args.relationPrompt,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [{ name: 'phase-doc-relations', status: 'pending' }],
    parameters: {
      scope: args.scope,
      sourceFileId: args.sourceFileId,
      relationType: args.relationType,
    },
  }

  await repo.create(job)
  return { jobId, jobSecret }
}
