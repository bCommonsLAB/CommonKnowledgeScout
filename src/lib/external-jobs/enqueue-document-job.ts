/**
 * @fileoverview Dokument-Jobs (PDF/Office) programmatisch einreihen (A1).
 *
 * @description
 * Pilot-Wunschliste A1: PDF/Office ueber die MCP-Bruecke erschliessen.
 * Dieselbe Job-Form wie `/api/pipeline/process` — upload-frei: der Worker
 * laedt das Binary selbst ueber `itemId` aus dem Storage (der frueher
 * dokumentierte „andere Upload-Contract" gilt nur fuer den Browser-Upload).
 * Eigene Datei neben `enqueue-secretary-job.ts` (200-Zeilen-Regel).
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { mediaKindToJobType } from '@/lib/media-types'
import type { ExternalJob } from '@/types/external-job'
import type { SourceRef } from './enqueue-secretary-job'

/** Ueber die Bruecke erschliessbare Dokument-Arten (Rest: siehe media-types). */
export type DocumentMediaKind = 'pdf' | 'docx' | 'xlsx' | 'pptx'

const DOCUMENT_MIME: Record<DocumentMediaKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

/** Dokument-Art aus dem Dateinamen; null = kein Bruecken-Dokument. */
export function documentMediaKindFromName(fileName: string): DocumentMediaKind | null {
  const match = fileName.toLowerCase().match(/\.(pdf|docx|xlsx|pptx)$/)
  return match ? (match[1] as DocumentMediaKind) : null
}

/**
 * Reiht einen Erschliessungs-Job fuer EIN Dokument ein (Form der
 * Pipeline-Route: Steps + parameters/policies identisch); der Worker
 * uebernimmt und laedt das Binary aus dem Storage.
 */
export async function enqueueSourceDocumentJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  mediaKind: DocumentMediaKind
  template?: string
  targetLanguage?: string
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)
  const template = args.template?.trim() || undefined
  const targetLanguage = args.targetLanguage ?? 'de'
  const jobType = mediaKindToJobType(args.mediaKind)
  const isOffice = args.mediaKind !== 'pdf'

  const job: Omit<ExternalJob, 'createdAt' | 'updatedAt'> & { steps: NonNullable<ExternalJob['steps']> } = {
    jobId,
    jobSecretHash,
    job_type: jobType,
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: args.mediaKind,
        mimeType: args.source.mimeType ?? DOCUMENT_MIME[args.mediaKind],
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: {
        targetLanguage,
        ...(isOffice
          ? { useCache: true, includeImages: true, includePreviews: true }
          : {}),
      },
    },
    steps: [
      { name: isOffice ? 'extract_office' : 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ],
    parameters: {
      targetLanguage,
      ...(template ? { template } : {}),
      phases: { extract: true, template: Boolean(template), ingest: Boolean(template) },
      policies: {
        extract: 'do',
        metadata: template ? 'do' : 'ignore',
        ingest: template ? 'do' : 'ignore',
      },
      ...(args.mediaKind === 'pdf'
        ? {
            extractionMethod: 'mistral_ocr',
            includeOcrImages: true,
            includePreviewPages: true,
            includeHighResPages: true,
            useCache: true,
          }
        : { useCache: true }),
    },
  }

  await repo.create(job)
  return { jobId }
}
