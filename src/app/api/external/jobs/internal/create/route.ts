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
    const extractionMethod = typeof body.extractionMethod === 'string' ? body.extractionMethod : 'native'
    
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includeOcrImages = body.includeOcrImages !== undefined
      ? Boolean(body.includeOcrImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includePageImages = body.includePageImages !== undefined
      ? Boolean(body.includePageImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeImages = Boolean(body.includeImages) // Rückwärtskompatibilität

    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const correlation = {
      jobId,
      libraryId,
      source: { mediaType: 'pdf', mimeType, name: fileName, parentId, itemId },
      options: { 
        targetLanguage, 
        extractionMethod, 
        includeOcrImages, 
        includePageImages, 
        includeImages // Rückwärtskompatibilität
      }
    } satisfies ExternalJob['correlation']

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { name: 'extract_pdf', status: 'completed', startedAt: new Date(), endedAt: new Date() },
        { name: 'transform_template', status: 'pending' },
        { name: 'store_shadow_twin', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      parameters: { 
        targetLanguage, 
        extractionMethod, 
        includeOcrImages, 
        includePageImages, 
        includeImages // Rückwärtskompatibilität
      }
    }
    await repo.create(job)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const callbackUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : `/api/external/jobs/${jobId}`

    return NextResponse.json({ jobId, callbackUrl, jobSecret }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}



