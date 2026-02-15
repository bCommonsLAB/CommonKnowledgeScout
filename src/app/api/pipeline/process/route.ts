/**
 * @fileoverview Unified Pipeline Endpoint - Single Entry Point for All Media Processing
 * 
 * @description
 * Zentraler Endpoint für die Verarbeitung aller Medientypen (PDF, Audio, Video, Markdown).
 * Unterstützt sowohl Einzel- als auch Batch-Verarbeitung.
 * 
 * Ersetzt/vereinheitlicht:
 * - /api/secretary/process-pdf
 * - /api/secretary/process-audio/job
 * - /api/secretary/process-video/job
 * - /api/secretary/process-text/job
 * - /api/secretary/process-pdf/batch
 * 
 * @module pipeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { LibraryService } from '@/lib/services/library-service'
import { getMediaKind, mediaKindToJobType, isPipelineSupported } from '@/lib/media-types'
import type { MediaKind, JobType } from '@/lib/media-types'
import type { PipelineRequest, PipelineResponse, PipelineItem } from '@/lib/pipeline/pipeline-config'
import type { ExternalJob } from '@/types/external-job'
import { FileLogger } from '@/lib/debug/logger'

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

/**
 * Erstellt ein StorageItem-ähnliches Objekt für getMediaKind
 */
function createStorageItemForMediaKind(item: PipelineItem): { metadata: { name: string; mimeType: string } } {
  return {
    metadata: {
      name: item.name,
      mimeType: item.mimeType || '',
    },
  }
}

/**
 * Bestimmt den MediaKind für ein PipelineItem
 */
function getItemMediaKind(item: PipelineItem): MediaKind {
  const storageItem = createStorageItemForMediaKind(item)
  return getMediaKind(storageItem as Parameters<typeof getMediaKind>[0])
}

/**
 * Erstellt einen Job für ein einzelnes Item
 */
async function createJobForItem(args: {
  item: PipelineItem
  libraryId: string
  userEmail: string
  request: PipelineRequest
  repo: ExternalJobsRepository
  batchId?: string
}): Promise<{ jobId: string; mediaKind: MediaKind; jobType: JobType } | { error: string }> {
  const { item, libraryId, userEmail, request, repo, batchId } = args
  const { config } = request
  
  // Medientyp erkennen
  const mediaKind = getItemMediaKind(item)
  
  // Prüfen ob Medientyp unterstützt wird
  if (!isPipelineSupported(mediaKind)) {
    return { error: `Medientyp '${mediaKind}' wird nicht unterstützt` }
  }
  
  const jobType = mediaKindToJobType(mediaKind)
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)
  
  // Policies anpassen: Bei Markdown ist Extract immer 'ignore'
  const finalPolicies = {
    ...config.policies,
    extract: mediaKind === 'markdown' ? 'ignore' as const : config.policies.extract,
  }
  
  // Correlation erstellen
  const correlation: ExternalJob['correlation'] = {
    jobId,
    libraryId,
    source: {
      mediaType: mediaKind,
      mimeType: item.mimeType || getMimeTypeForMediaKind(mediaKind),
      name: item.name,
      itemId: item.fileId,
      parentId: item.parentId,
    },
    options: {
      targetLanguage: config.targetLanguage,
      // Office-spezifische Optionen (Secretary /api/office/process)
      ...((mediaKind === 'docx' || mediaKind === 'xlsx' || mediaKind === 'pptx') ? {
        useCache: request.useCache ?? true,
        includeImages: true,
        includePreviews: true,
      } : {}),
    },
    batchId,
    batchName: request.batchName,
  }
  
  // Job erstellen
  // Steps basierend auf Medientyp festlegen
  const extractStepName = getExtractStepName(jobType)
  
  try {
    await repo.create({
      jobId,
      jobSecretHash,
      job_type: jobType,
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { name: extractStepName, status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      parameters: {
        targetLanguage: config.targetLanguage,
        ...(config.templateName ? { template: config.templateName } : {}),
        phases: {
          extract: mediaKind !== 'markdown' && config.phases.extract,
          template: config.phases.template,
          ingest: config.phases.ingest,
        },
        policies: finalPolicies,
        generateCoverImage: config.generateCoverImage,
        coverImagePrompt: config.coverImagePrompt,
        // Korrekturhinweis: auch leeren String übernehmen (explizites Löschen durch User)
        ...(typeof config.customHint === 'string' ? { customHint: config.customHint } : {}),
        // LLM-Modell für Template-Transformation
        ...(config.llmModel ? { llmModel: config.llmModel } : {}),
        // PDF-spezifische Optionen
        ...(mediaKind === 'pdf' ? {
          extractionMethod: request.extractionMethod || 'mistral_ocr',
          includeOcrImages: request.includeOcrImages ?? true,
          includePageImages: request.includePageImages ?? true,
          useCache: request.useCache ?? true,
        } : {}),
        // Office-spezifische Optionen (useCache für Secretary)
        ...((mediaKind === 'docx' || mediaKind === 'xlsx' || mediaKind === 'pptx') ? {
          useCache: request.useCache ?? true,
        } : {}),
      },
    } as unknown as Parameters<ExternalJobsRepository['create']>[0])
    
    return { jobId, mediaKind, jobType }
  } catch (error) {
    FileLogger.error('pipeline/process', 'Fehler beim Erstellen des Jobs', {
      error: error instanceof Error ? error.message : String(error),
      item,
    })
    return { error: error instanceof Error ? error.message : 'Unbekannter Fehler' }
  }
}

/**
 * Gibt den korrekten Extract-Step-Namen für einen JobType zurück
 */
function getExtractStepName(jobType: JobType): 'extract_pdf' | 'extract_audio' | 'extract_video' | 'extract_office' {
  switch (jobType) {
    case 'audio':
      return 'extract_audio'
    case 'video':
      return 'extract_video'
    case 'office':
      return 'extract_office'
    default:
      return 'extract_pdf'
  }
}

/**
 * Gibt einen Standard-MIME-Type für einen MediaKind zurück
 */
function getMimeTypeForMediaKind(kind: MediaKind): string {
  switch (kind) {
    case 'pdf':
      return 'application/pdf'
    case 'audio':
      return 'audio/*'
    case 'video':
      return 'video/*'
    case 'image':
      return 'image/*'
    case 'markdown':
      return 'text/markdown'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    default:
      return 'application/octet-stream'
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authentifizierung
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
    }
    
    // Request-Body parsen
    const body = await request.json().catch(() => null) as PipelineRequest | null
    if (!body) {
      return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
    }
    
    const { libraryId, item, items, config } = body
    
    // Validierung
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })
    }
    
    if (!config) {
      return NextResponse.json({ error: 'config erforderlich' }, { status: 400 })
    }
    
    if (!item && (!items || items.length === 0)) {
      return NextResponse.json({ error: 'item oder items erforderlich' }, { status: 400 })
    }
    
    // Library prüfen
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined)
    if (!lib) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }
    
    // Repository erstellen
    const repo = new ExternalJobsRepository()
    
    // Items sammeln (Einzel- oder Batch-Modus)
    const itemsToProcess: PipelineItem[] = item ? [item] : (items || [])
    
    // Batch-ID generieren wenn Batch-Modus
    const batchId = itemsToProcess.length > 1 ? crypto.randomUUID() : undefined
    
    // Jobs erstellen
    const response: PipelineResponse = {
      jobs: [],
      successCount: 0,
      failures: [],
      failureCount: 0,
      batchId,
    }
    
    for (const pipelineItem of itemsToProcess) {
      const result = await createJobForItem({
        item: pipelineItem,
        libraryId,
        userEmail,
        request: body,
        repo,
        batchId,
      })
      
      if ('error' in result) {
        response.failures.push({
          fileId: pipelineItem.fileId,
          fileName: pipelineItem.name,
          error: result.error,
        })
        response.failureCount++
      } else {
        response.jobs.push({
          jobId: result.jobId,
          fileId: pipelineItem.fileId,
          fileName: pipelineItem.name,
          mediaKind: result.mediaKind,
          jobType: result.jobType,
        })
        response.successCount++
        
        // Event Bus benachrichtigen
        getJobEventBus().emitUpdate(userEmail, {
          type: 'job_update',
          jobId: result.jobId,
          status: 'queued',
          progress: 0,
          updatedAt: new Date().toISOString(),
          message: 'Job erstellt',
          jobType: result.jobType,
          fileName: pipelineItem.name,
          sourceItemId: pipelineItem.fileId,
          libraryId,
        })
      }
    }
    
    // Worker triggern (best-effort)
    try {
      await fetch(`${request.nextUrl.origin}/api/external/jobs/worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      })
    } catch {
      // Worker-Trigger-Fehler ignorieren
    }
    
    FileLogger.info('pipeline/process', 'Pipeline-Jobs erstellt', {
      libraryId,
      successCount: response.successCount,
      failureCount: response.failureCount,
      batchId,
    })
    
    return NextResponse.json(response)
    
  } catch (error) {
    FileLogger.error('pipeline/process', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
