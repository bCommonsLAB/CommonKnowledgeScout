/**
 * @fileoverview Secretary-Jobs programmatisch einreihen (MCP-Bruecke, Welle 5).
 *
 * @description
 * Dieselben Job-Formen, die die `/api/secretary/process-{audio,video,text}/job`-
 * Routen bauen — als Service fuer Aufrufer OHNE Clerk-Session (MCP-Werkzeuge
 * `quelle_erschliessen` / `transformation_starten`). Der External-Jobs-Worker
 * uebernimmt die Verarbeitung wie bisher (Strangler unveraendert):
 *
 * - Quelle erschliessen (audio/video): Job `transcribe`; der Worker laedt das
 *   Binary selbst aus dem Storage. Mit `template` laeuft danach auch
 *   Template+Ingest (voll erschliessen), ohne bleibt es Transcript-only.
 * - Template auf vorhandenen Text (Muster der text-Job-Route): Job mit
 *   `extract: ignore` anlegen und den Callback direkt mit `extracted_text`
 *   fuettern — der Text kommt beim MCP-Werkzeug aus dem Mongo-Transkript,
 *   der Job haengt an der QUELLE (dort landet die Transformation).
 *
 * Die Job-Objekte werden von reinen Buildern erzeugt (unit-testbar).
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getSelfBaseUrl } from '@/lib/env'
import type { PhasePolicies } from '@/lib/processing/phase-policy'
import type { ExternalJob } from '@/types/external-job'

export interface SourceRef {
  itemId: string
  parentId: string
  name: string
  mimeType?: string
}

export type EnqueueJob = Omit<ExternalJob, 'createdAt' | 'updatedAt'>

export interface BuiltJob {
  job: EnqueueJob
  jobSecret: string
}

function newJobIdentity(repo: ExternalJobsRepository): { jobId: string; jobSecret: string; jobSecretHash: string } {
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  return { jobId, jobSecret, jobSecretHash: repo.hashSecret(jobSecret) }
}

/** Erschliessungs-Job (audio/video) — exakt die Form der Job-Routen. */
export function buildSourceTranscribeJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  source: SourceRef
  mediaType: 'audio' | 'video'
  template?: string
  targetLanguage?: string
}): EnqueueJob {
  const template = args.template?.trim() || undefined
  const policies: PhasePolicies = template
    ? { extract: 'do', metadata: 'do', ingest: 'do' }
    : { extract: 'do', metadata: 'ignore', ingest: 'ignore' }
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: args.mediaType,
    operation: 'transcribe',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: args.mediaType,
        mimeType: args.source.mimeType ?? `${args.mediaType}/*`,
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: { targetLanguage: args.targetLanguage ?? 'de', sourceLanguage: 'auto', useCache: true },
    },
    parameters: {
      ...(template ? { template } : {}),
      policies,
      phases: {
        extract: true,
        template: Boolean(template),
        ingest: Boolean(template),
        images: false,
      },
    },
  }
}

/** Template-auf-Text-Job (Muster der text-Job-Route, extract wird gefuettert). */
export function buildTemplateOnTextJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  /** Die QUELLE der Familie — dort landet die Transformation. */
  source: SourceRef
  template: string
  targetLanguage?: string
}): EnqueueJob {
  const template = args.template.trim()
  if (!template) throw new Error('template ist Pflicht fuer Template-auf-Text-Jobs')
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
        mimeType: 'text/markdown',
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: { targetLanguage: args.targetLanguage ?? 'de', sourceLanguage: 'auto', useCache: true },
    },
    parameters: {
      template,
      policies: { extract: 'ignore', metadata: 'do', ingest: 'do' },
      phases: { extract: false, template: true, ingest: true, images: false },
    },
  }
}

/** Reiht einen Erschliessungs-Job ein; der Worker uebernimmt. */
export async function enqueueSourceTranscribeJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  mediaType: 'audio' | 'video'
  template?: string
  targetLanguage?: string
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const { jobId, jobSecretHash } = newJobIdentity(repo)
  const job = buildSourceTranscribeJob({ ...args, jobId, jobSecretHash })
  await repo.create(job)
  return { jobId }
}

/**
 * Reiht einen Template-auf-Text-Job ein und fuettert den Callback mit dem
 * Text (wie die text-Job-Route). Schlaegt das Fuettern fehl, wird das LAUT
 * gemeldet — der Job bliebe sonst ewig `queued`.
 */
export async function enqueueTemplateOnTextJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  template: string
  targetLanguage?: string
  extractedText: string
}): Promise<{ jobId: string }> {
  if (!args.extractedText.trim()) throw new Error('extractedText ist leer — nichts zu transformieren')
  const repo = new ExternalJobsRepository()
  const { jobId, jobSecret, jobSecretHash } = newJobIdentity(repo)
  const job = buildTemplateOnTextJob({ ...args, jobId, jobSecretHash })
  await repo.create(job)

  const callbackUrl = `${getSelfBaseUrl().replace(/\/$/, '')}/api/external/jobs/${jobId}`
  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jobSecret}`,
      'X-Internal-Token': process.env.INTERNAL_TEST_TOKEN || '',
    },
    body: JSON.stringify({ data: { extracted_text: args.extractedText } }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Job ${jobId} angelegt, aber der Text-Feed schlug fehl (HTTP ${response.status}): ${text.slice(0, 200)}`,
    )
  }
  return { jobId }
}
