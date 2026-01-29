/**
 * @fileoverview Secretary Text/Markdown Job API Route - Enqueue Text via External Jobs
 *
 * @description
 * Creates an External Job for text/markdown transformation (template+ingest).
 * For markdown files, extraction is skipped (extract=ignore) since the text source
 * is already available. The job loads the file, strips frontmatter, and feeds
 * the callback directly with extracted_text.
 *
 * IMPORTANT
 * - Does NOT send the file to Secretary for extraction.
 * - Requires `originalItemId` + `parentId` so we can load the binary from Storage.
 * - Extracts text locally and feeds callback directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { getServerProvider } from '@/lib/storage/server-provider'
import { LibraryService } from '@/lib/services/library-service'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import type { ExternalJob } from '@/types/external-job'
import type { PhasePolicies } from '@/lib/processing/phase-policy'
import { FileLogger } from '@/lib/debug/logger'

interface Body {
  originalItemId: string
  parentId: string
  fileName: string
  mimeType?: string
  targetLanguage?: string
  template?: string
  policies?: PhasePolicies
  batchId?: string
  batchName?: string
  /** Cover-Bild automatisch generieren */
  generateCoverImage?: boolean
  /** Optionaler Prompt für Cover-Bild-Generierung */
  coverImagePrompt?: string
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

    // Load library and provider
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)

    // Load file and extract text (strip frontmatter)
    let extractedText = ''
    try {
      const { blob } = await provider.getBinary(originalItemId)
      const markdown = await blob.text()
      extractedText = stripAllFrontmatter(markdown)
    } catch (error) {
      FileLogger.error('process-text/job', 'Fehler beim Laden der Datei', {
        error: error instanceof Error ? error.message : String(error),
        itemId: originalItemId,
      })
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 404 })
    }

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    // Template ist OPTIONAL. Wenn kein Template angegeben ist, ist das ein Extract-only Job.
    const template =
      typeof body.template === 'string' && body.template.trim() ? body.template.trim() : undefined

    const hasValidPolicies =
      !!(body.policies && body.policies.extract && body.policies.metadata && body.policies.ingest)

    // Default: Extract immer ignore (Textquelle bereits vorhanden), Template/Ingest je nach Template
    const policies: PhasePolicies = hasValidPolicies
      ? (body.policies as PhasePolicies)
      : (template
          ? { extract: 'ignore', metadata: 'do', ingest: 'do' }
          : { extract: 'ignore', metadata: 'ignore', ingest: 'ignore' })

    // Ensure extract is always 'ignore' for text/markdown
    const finalPolicies: PhasePolicies = {
      ...policies,
      extract: 'ignore',
    }

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'markdown',
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'text/markdown',
        name: fileName,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
      },
      batchId: typeof body.batchId === 'string' ? body.batchId : undefined,
      batchName: typeof body.batchName === 'string' ? body.batchName : undefined,
    }

    // Cover-Bild-Generierung aus Body lesen
    const generateCoverImage = body.generateCoverImage === true
    const coverImagePrompt = typeof body.coverImagePrompt === 'string' ? body.coverImagePrompt : undefined

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'text',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        ...(template ? { template } : {}),
        policies: finalPolicies,
        phases: {
          extract: false, // Always false for text/markdown
          template: finalPolicies.metadata !== 'ignore',
          ingest: finalPolicies.ingest !== 'ignore',
          images: false, // Text has no images phase
        },
        // Cover-Bild-Generierung
        ...(generateCoverImage ? { generateCoverImage } : {}),
        ...(coverImagePrompt ? { coverImagePrompt } : {}),
      },
    }

    await repo.create(job)

    // Initialize steps
    await repo.initializeSteps(
      jobId,
      [
        { name: 'extract_text', status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      {
        targetLanguage,
        template,
        phases: {
          extract: false,
          template: finalPolicies.metadata !== 'ignore',
          ingest: finalPolicies.ingest !== 'ignore',
        },
        policies: finalPolicies,
        // Cover-Bild-Generierung
        generateCoverImage,
        coverImagePrompt,
      }
    )

    // Feed callback directly with extracted_text (skip extraction phase)
    // Use jobSecret for callback authorization (internal token bypass also works)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const callbackUrl = appUrl
        ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
        : `/api/external/jobs/${jobId}`

      const callbackResponse = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jobSecret}`,
          'X-Internal-Token': process.env.INTERNAL_TEST_TOKEN || '',
        },
        body: JSON.stringify({
          data: {
            extracted_text: extractedText,
          },
        }),
      })

      if (!callbackResponse.ok) {
        FileLogger.warn('process-text/job', 'Callback konnte nicht gefüttert werden', {
          status: callbackResponse.status,
          jobId,
        })
        // Continue anyway - worker will handle it
      }
    } catch (error) {
      FileLogger.warn('process-text/job', 'Fehler beim Füttern des Callbacks', {
        error: error instanceof Error ? error.message : String(error),
        jobId,
      })
      // Continue anyway - worker will handle it
    }

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
  } catch (error) {
    FileLogger.error('process-text/job', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 })
  }
}
