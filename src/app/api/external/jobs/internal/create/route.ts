import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'
import { hasInternalTokenBypass } from '@/lib/external-jobs/auth'
import { getMediaKind } from '@/lib/media-types'
import type { StorageItem } from '@/lib/storage/types'

export async function POST(request: NextRequest) {
  try {
    if (!hasInternalTokenBypass(request.headers)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : ''
    const parentId = typeof body.parentId === 'string' ? body.parentId : 'root'
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'test.pdf'
    const itemId = typeof body.itemId === 'string' ? body.itemId : undefined
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/pdf'
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail : 'test@example.com'
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = typeof body.extractionMethod === 'string' ? body.extractionMethod : 'mistral_ocr'
    
    // Fuer Mistral OCR: alle Bild-Flags standardmaessig true.
    // Hard-Rename: getrennte Flags fuer Vorschau (Low-Res) und HighRes (200 DPI).
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includePreviewPages = body.includePreviewPages !== undefined
      ? Boolean(body.includePreviewPages)
      : (isMistralOcr ? true : undefined);
    const includeHighResPages = body.includeHighResPages !== undefined
      ? Boolean(body.includeHighResPages)
      : (isMistralOcr ? true : undefined);
    const includeOcrImages = body.includeOcrImages !== undefined
      ? Boolean(body.includeOcrImages)
      : (isMistralOcr ? true : undefined);
    const includeImages = Boolean(body.includeImages) // Rückwärtskompatibilität

    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    // Media-Type + Job-Type ableiten (Integrationstests / interne Job-Erstellung).
    // Kritisch: Bilder (image/* oder Bild-Endung) müssen job_type "image" bekommen – sonst
    // prepareSecretaryRequest → PDF-Endpoint statt Image-Analyzer in der Start-Route.
    const explicitMediaTypeRaw = typeof body.mediaType === 'string' ? body.mediaType.trim() : undefined
    const syntheticItem: StorageItem = {
      id: itemId || '_pending_',
      parentId,
      type: 'file',
      metadata: {
        name: fileName,
        mimeType,
        size: 0,
        modifiedAt: new Date(),
      },
    }
    const detectedKind = getMediaKind(syntheticItem)

    let jobType: ExternalJob['job_type']
    let sourceMediaType: string

    if (
      explicitMediaTypeRaw === 'audio' ||
      explicitMediaTypeRaw === 'video' ||
      explicitMediaTypeRaw === 'image' ||
      explicitMediaTypeRaw === 'office' ||
      explicitMediaTypeRaw === 'pdf'
    ) {
      jobType =
        explicitMediaTypeRaw === 'office'
          ? 'office'
          : (explicitMediaTypeRaw as ExternalJob['job_type'])
      sourceMediaType = explicitMediaTypeRaw
    } else {
      switch (detectedKind) {
        case 'audio':
          jobType = 'audio'
          sourceMediaType = 'audio'
          break
        case 'video':
          jobType = 'video'
          sourceMediaType = 'video'
          break
        case 'image':
          jobType = 'image'
          sourceMediaType = 'image'
          break
        case 'docx':
        case 'xlsx':
        case 'pptx':
          jobType = 'office'
          sourceMediaType = 'office'
          break
        case 'pdf':
          jobType = 'pdf'
          sourceMediaType = 'pdf'
          break
        default:
          // Legacy: unbekannte Dateien ohne Audio-Signatur wie bisher als PDF-Job
          jobType = mimeType.startsWith('audio/') ? 'audio' : 'pdf'
          sourceMediaType = jobType === 'audio' ? 'audio' : 'pdf'
      }
    }

    const extractStepName =
      jobType === 'audio'
        ? 'extract_audio'
        : jobType === 'video'
          ? 'extract_video'
          : jobType === 'office'
            ? 'extract_office'
            : jobType === 'image'
              ? 'extract_image'
              : 'extract_pdf'

    const correlationOptions =
      jobType === 'office'
        ? { targetLanguage, useCache: true, includeImages: true, includePreviews: true }
        : jobType === 'image'
          ? { targetLanguage }
          : {
              targetLanguage,
              extractionMethod,
              includeOcrImages,
              includePreviewPages,
              includeHighResPages,
              includeImages,
            }

    const correlation = {
      jobId,
      libraryId,
      source: { mediaType: sourceMediaType, mimeType, name: fileName, parentId, itemId },
      options: correlationOptions
    } satisfies ExternalJob['correlation']

    const jobParameters =
      jobType === 'office'
        ? { targetLanguage, useCache: true }
        : jobType === 'image'
          ? { targetLanguage }
          : { targetLanguage, extractionMethod, includeOcrImages, includePreviewPages, includeHighResPages, includeImages }

    const job: ExternalJob = {
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
        // Start-Route initialisiert Steps erneut. Dieser Eintrag ist nur ein Platzhalter.
        { name: extractStepName, status: 'completed', startedAt: new Date(), endedAt: new Date() },
        { name: 'transform_template', status: 'pending' },
        { name: 'store_shadow_twin', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      parameters: jobParameters
    }
    await repo.create(job)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const callbackUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : `/api/external/jobs/${jobId}`

    return NextResponse.json({ jobId, callbackUrl, jobSecret }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}



