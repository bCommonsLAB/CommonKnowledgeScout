/**
 * @fileoverview Golden-Set-Lauf als External Job einreihen (Welle F).
 *
 * @description
 * Ein Golden-Set mit zehn Fragen braucht Minuten (rund 36 s je Frage mit
 * Modell) — die 60-Sekunden-Grenze der Bruecke laesst keinen synchronen
 * Aufruf zu. Also EIN Job (`job_type: 'golden-set'`, `operation: 'run'`),
 * den der Worker ueber `/start` anstoesst; die Start-Route verzweigt frueh
 * in `phase-golden-set` (ADR 0001, wie doc-relations/overlap-report) und
 * antwortet 202, die Phase laeuft detached und schreibt Stand und Ergebnis
 * selbst. Reiner Builder, unit-testbar.
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

export const GOLDEN_SET_JOB_TYPE = 'golden-set'
export const GOLDEN_SET_OPERATION = 'run'
export const GOLDEN_SET_STEP = 'golden_set'

export interface GoldenSetJobOptionen {
  /** Storage-Id der Set-Datei (JSON) in der Library. */
  setSourceId: string
  setName: string
  /** Ordner der Set-Datei — dort landet der Bericht als Markdown. */
  setParentId: string
  titel: string
  baseline: boolean
  retriever: 'auto' | 'chunk' | 'summary'
  temperature: number
  nur?: string[]
  richterModel?: string
  model?: string
}

export function buildGoldenSetJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  optionen: GoldenSetJobOptionen
}): Omit<ExternalJob, 'createdAt' | 'updatedAt'> {
  const { optionen } = args
  if (!optionen.titel.trim()) throw new Error('titel ist Pflicht — der Bericht traegt ihn')
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: GOLDEN_SET_JOB_TYPE,
    operation: GOLDEN_SET_OPERATION,
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: { itemId: optionen.setSourceId, parentId: optionen.setParentId, name: `Golden-Set: ${optionen.titel}`, mediaType: 'golden-set' },
      options: { ...optionen },
    },
    steps: [{ name: GOLDEN_SET_STEP, status: 'pending' }],
    parameters: { phase: 'phase-golden-set', baseline: optionen.baseline, titel: optionen.titel },
  }
}

export async function enqueueGoldenSetJob(args: {
  libraryId: string
  userEmail: string
  optionen: GoldenSetJobOptionen
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecretHash = repo.hashSecret(crypto.randomBytes(24).toString('base64url'))
  await repo.create(buildGoldenSetJob({ ...args, jobId, jobSecretHash }))
  return { jobId }
}

/** Optionen typgeprueft aus dem Job lesen — ein kaputter Job faellt laut, nicht mit Defaults. */
export function leseGoldenSetOptionen(job: ExternalJob): GoldenSetJobOptionen {
  const o = (job.correlation?.options ?? {}) as Partial<GoldenSetJobOptionen>
  if (typeof o.setSourceId !== 'string' || typeof o.setParentId !== 'string' || typeof o.setName !== 'string') {
    throw new Error('Golden-Set-Job ohne setSourceId/setParentId/setName')
  }
  if (typeof o.titel !== 'string' || typeof o.baseline !== 'boolean' || typeof o.temperature !== 'number') {
    throw new Error('Golden-Set-Job ohne titel/baseline/temperature')
  }
  if (o.retriever !== 'auto' && o.retriever !== 'chunk' && o.retriever !== 'summary') {
    throw new Error(`Golden-Set-Job mit unbekanntem retriever "${String(o.retriever)}"`)
  }
  return {
    setSourceId: o.setSourceId, setParentId: o.setParentId, setName: o.setName, titel: o.titel, baseline: o.baseline,
    retriever: o.retriever, temperature: o.temperature,
    ...(Array.isArray(o.nur) ? { nur: o.nur.filter((s): s is string => typeof s === 'string') } : {}),
    ...(typeof o.richterModel === 'string' ? { richterModel: o.richterModel } : {}),
    ...(typeof o.model === 'string' ? { model: o.model } : {}),
  }
}
