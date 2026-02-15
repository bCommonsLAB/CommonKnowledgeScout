import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'
import { hasInternalTokenBypass } from '@/lib/external-jobs/auth'

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
    
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = body.includePageImages !== undefined
      ? Boolean(body.includePageImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeOcrImages = body.includeOcrImages !== undefined
      ? Boolean(body.includeOcrImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeImages = Boolean(body.includeImages) // Rückwärtskompatibilität

    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    // Media-Type + Job-Type ableiten (für PDF und Audio Integrationstests).
    // WICHTIG:
    // - Diese Route wird von Integrationstests genutzt und muss daher mehrere Medientypen unterstützen.
    // - Für unknown Types bleiben wir beim bisherigen Default "pdf".
    const explicitMediaType = typeof body.mediaType === 'string' ? body.mediaType : undefined
    const inferredMediaType =
      explicitMediaType
        ? explicitMediaType
        : (mimeType.startsWith('audio/') ? 'audio' : 'pdf')

    const jobType: ExternalJob['job_type'] =
      inferredMediaType === 'audio'
        ? 'audio'
        : inferredMediaType === 'office'
          ? 'office'
          : 'pdf'

    const extractStepName =
      jobType === 'audio' ? 'extract_audio' : jobType === 'office' ? 'extract_office' : 'extract_pdf'

    // Office-Jobs haben andere Options (kein extractionMethod, includeOcrImages etc.)
    const correlationOptions = jobType === 'office'
      ? { targetLanguage, useCache: true, includeImages: true, includePreviews: true }
      : {
          targetLanguage,
          extractionMethod,
          includeOcrImages,
          includePageImages,
          includeImages, // Rückwärtskompatibilität
        }

    const correlation = {
      jobId,
      libraryId,
      source: { mediaType: inferredMediaType, mimeType, name: fileName, parentId, itemId },
      options: correlationOptions
    } satisfies ExternalJob['correlation']

    const jobParameters = jobType === 'office'
      ? { targetLanguage, useCache: true }
      : { targetLanguage, extractionMethod, includeOcrImages, includePageImages, includeImages }

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



