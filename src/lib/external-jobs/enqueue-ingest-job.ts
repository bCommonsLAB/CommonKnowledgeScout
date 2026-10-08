/**
 * @fileoverview Ingest-only-Jobs einreihen (Welle C, `index_aktualisieren`).
 *
 * @description
 * „Index folgt dem Twin": Nach einer neuen Facette, einer geaenderten
 * Vorlage oder einer Twin-Korrektur muss nur Phase 3 laufen — die
 * vorhandene Transformation wird neu in den Index geschrieben. Die Job-Form
 * ist die der Pipeline-Route mit `phases.ingest` allein; die Start-Route
 * nimmt dafuer ihren `runIngestOnly`-Pfad und laedt die Transformation aus
 * dem Twin (`forIngestOrPassthrough`). `ingest: 'force'`, weil das
 * Ingest-Gate sonst „schon ingestiert" liest und nichts schreibt.
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getMediaKindFromName, isPipelineSupported, mediaKindToJobType, type JobType } from '@/lib/media-types'
import type { ExternalJob } from '@/types/external-job'
import type { SourceRef } from './enqueue-secretary-job'

export type IngestOnlyJob = Omit<ExternalJob, 'createdAt' | 'updatedAt'> & { steps: NonNullable<ExternalJob['steps']> }

/** Schrittname der Extract-Phase je Job-Typ — wie in der Pipeline-Route. */
function extractSchritt(jobType: JobType): string {
  switch (jobType) {
    case 'audio': return 'extract_audio'
    case 'video': return 'extract_video'
    case 'office': return 'extract_office'
    case 'image': return 'extract_image'
    case 'pdf':
    case 'text':
      return 'extract_pdf'
    default:
      throw new Error(`Unbekannter Job-Typ "${String(jobType)}"`)
  }
}

/** Reiner Builder (unit-testbar). */
export function buildIngestOnlyJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  source: SourceRef
  /** Vorlage der vorhandenen Transformation — der Loader waehlt danach das Artefakt. */
  template: string
  targetLanguage: string
  batchId?: string
  batchName?: string
}): IngestOnlyJob {
  const template = args.template.trim()
  if (!template) throw new Error('template ist Pflicht — ohne Vorlage ist nicht bestimmt, welche Transformation ingestiert wird')
  const mediaKind = getMediaKindFromName(args.source.name, args.source.mimeType ?? '')
  if (!isPipelineSupported(mediaKind)) throw new Error(`"${args.source.name}" (${mediaKind}) kennt die Pipeline nicht`)
  const jobType = mediaKindToJobType(mediaKind)
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: jobType,
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: mediaKind,
        mimeType: args.source.mimeType ?? '',
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: { targetLanguage: args.targetLanguage },
      ...(args.batchId ? { batchId: args.batchId } : {}),
      ...(args.batchName ? { batchName: args.batchName } : {}),
    },
    steps: [
      { name: extractSchritt(jobType), status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ],
    parameters: {
      targetLanguage: args.targetLanguage,
      template,
      phases: { extract: false, template: false, ingest: true },
      policies: { extract: 'ignore', metadata: 'ignore', ingest: 'force' },
    },
  }
}

/** Reiht den Job ein; der Worker uebernimmt und laedt die Transformation aus dem Twin. */
export async function enqueueIngestOnlyJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  template: string
  targetLanguage: string
  batchId?: string
  batchName?: string
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecretHash = repo.hashSecret(crypto.randomBytes(24).toString('base64url'))
  await repo.create(buildIngestOnlyJob({ ...args, jobId, jobSecretHash }))
  return { jobId }
}
