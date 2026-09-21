/**
 * @fileoverview Markdown-Jobs (auch Sammeldateien) programmatisch einreihen.
 *
 * @description
 * Bruecken-Luecke vom 21.09.2026: `transformation_starten` verlangte ein
 * gespeichertes Transkript — eine Markdown-Quelle hat keines, sie IST der Text.
 * Hier entsteht dieselbe Job-Form wie in `/api/pipeline/process` fuer
 * Markdown: KEIN vorab gefuetterter Text. Der Worker laedt die Quelldatei
 * selbst (`phase-shadow-twin-loader.ts`, Prioritaet 0) und loest
 * `kind: composite-transcript` zur Laufzeit auf — nur so kommen Medien,
 * Anhaenge und Video-Felder der Sammeldatei wie im UI mit.
 * Eigene Datei neben `enqueue-document-job.ts` (200-Zeilen-Regel).
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'
import type { SourceRef } from './enqueue-secretary-job'

export type MarkdownJob = Omit<ExternalJob, 'createdAt' | 'updatedAt'> & {
  steps: NonNullable<ExternalJob['steps']>
}

/** Reiner Builder (unit-testbar) — Form der Pipeline-Route fuer Markdown. */
export function buildSourceMarkdownJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  source: SourceRef
  template: string
  /** LLM-Modell fuer die Template-Transformation (siehe enqueue-document-job). */
  llmModel?: string
  targetLanguage?: string
  /**
   * Template-Gate uebergehen (`policies.metadata: 'force'`): Haengt am Twin
   * schon eine Transformation, ueberspringt der Worker die Template-Phase sonst
   * und meldet trotzdem `completed` (Befund 21.09.2026).
   */
  erzwingen?: boolean
}): MarkdownJob {
  const template = args.template.trim()
  if (!template) throw new Error('template ist Pflicht fuer Markdown-Transformationen')
  const llmModel = args.llmModel?.trim() || undefined
  const targetLanguage = args.targetLanguage ?? 'de'
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: 'text',
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: 'markdown',
        mimeType: args.source.mimeType ?? 'text/markdown',
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: { targetLanguage },
    },
    // Der Extract-Schritt heisst bei Text-Jobs wie in der Pipeline-Route
    // `extract_pdf`; der Worker schliesst ihn als uebersprungen ab.
    steps: [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ],
    parameters: {
      targetLanguage,
      template,
      // Welle ST8: ohne dieses Feld nimmt der Secretary seinen eigenen Default.
      ...(llmModel ? { llmModel } : {}),
      phases: { extract: false, template: true, ingest: true },
      policies: { extract: 'ignore', metadata: args.erzwingen === true ? 'force' : 'do', ingest: 'do' },
    },
  }
}

/** Reiht den Job ein; der Worker uebernimmt und laedt die Quelle selbst. */
export async function enqueueSourceMarkdownJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  template: string
  llmModel?: string
  targetLanguage?: string
  erzwingen?: boolean
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecretHash = repo.hashSecret(crypto.randomBytes(24).toString('base64url'))
  await repo.create(buildSourceMarkdownJob({ ...args, jobId, jobSecretHash }))
  return { jobId }
}
