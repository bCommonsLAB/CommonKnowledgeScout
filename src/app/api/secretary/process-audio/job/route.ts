/**
 * @fileoverview Secretary Audio Job API Route - Enqueue Audio via External Jobs
 *
 * @description
 * Creates an External Job for audio transcription (and optional template+ingest).
 * This keeps the orchestration inside the existing External Jobs worker (Strangler).
 *
 * IMPORTANT
 * - Does NOT send the file to Secretary directly.
 * - Requires `originalItemId` + `parentId` so the worker can load the binary from Storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import type { ExternalJob } from '@/types/external-job'
import type { PhasePolicies } from '@/lib/processing/phase-policy'

interface Body {
  originalItemId: string
  parentId: string
  fileName: string
  mimeType?: string
  targetLanguage?: string
  sourceLanguage?: string
  useCache?: boolean
  template?: string
  policies?: PhasePolicies
  batchId?: string
  batchName?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || ''
    if (!libraryId) return NextResponse.json({ error: 'X-Library-Id erforderlich' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as Partial<Body>
    const originalItemId = typeof body.originalItemId === 'string' ? body.originalItemId : ''
    const parentId = typeof body.parentId === 'string' ? body.parentId : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName : ''
    if (!originalItemId || !parentId || !fileName) {
      return NextResponse.json({ error: 'originalItemId, parentId, fileName erforderlich' }, { status: 400 })
    }

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    const sourceLanguage = typeof body.sourceLanguage === 'string' ? body.sourceLanguage : 'auto'
    const useCache = typeof body.useCache === 'boolean' ? body.useCache : true
    // Template ist OPTIONAL. Wenn kein Template angegeben ist, ist das ein Transcript-only Job.
    const template =
      typeof body.template === 'string' && body.template.trim() ? body.template.trim() : undefined

    const hasValidPolicies =
      !!(body.policies && body.policies.extract && body.policies.metadata && body.policies.ingest)

    // Default (Audio): Transcript-only (keine Template-/Ingest-Phase), außer der Client verlangt es explizit.
    const policies: PhasePolicies = hasValidPolicies
      ? (body.policies as PhasePolicies)
      : (template
          ? { extract: 'do', metadata: 'do', ingest: 'do' }
          : { extract: 'do', metadata: 'ignore', ingest: 'ignore' })

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'audio',
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'audio/*',
        name: fileName,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
        sourceLanguage,
        useCache,
      },
      batchId: typeof body.batchId === 'string' ? body.batchId : undefined,
      batchName: typeof body.batchName === 'string' ? body.batchName : undefined,
    }

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'audio',
      operation: 'transcribe',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        ...(template ? { template } : {}),
        policies,
        phases: {
          extract: policies.extract !== 'ignore',
          template: policies.metadata !== 'ignore',
          ingest: policies.ingest !== 'ignore',
          images: false, // Audio hat keine Images-Phase
        },
      },
    }

    await repo.create(job)

    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName,
        sourceItemId: originalItemId,
        libraryId,
      })
    } catch {}

    return NextResponse.json({ status: 'accepted', job: { id: jobId } }, { status: 202 })
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 })
  }
}


