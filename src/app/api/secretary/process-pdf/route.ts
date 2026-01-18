/**
 * @fileoverview Secretary PDF Processing API Route - PDF Transformation Endpoint
 * 
 * @description
 * API endpoint for processing PDF files via Secretary Service. Creates external jobs
 * for PDF extraction, handles authentication, job creation, and triggers Secretary
 * Service processing. Supports batch processing, policy configuration, and callback
 * URL setup.
 * 
 * @module secretary
 * 
 * @exports
 * - POST: Creates PDF processing job and triggers Secretary Service
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/secretary/process-pdf
 * - src/components/library: Library components call this endpoint
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository for job creation
 * - @/lib/secretary/client: Secretary Service client
 * - @/lib/processing/phase-policy: Policy configuration
 * - @/lib/events/job-event-bus: Event bus for status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import type { ExternalJob } from '@/types/external-job';
import { legacyToPolicies, type PhasePolicies } from '@/lib/processing/phase-policy';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const formData = await request.formData();

    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = (formData.get('extractionMethod') as string) || 'mistral_ocr';
    
    // Neue Parameter-Namen für Mistral OCR:
    // - includeOcrImages: Mistral OCR Bilder als Base64 (in mistral_ocr_raw.pages[*].images[*].image_base64)
    // - includePageImages: Seiten-Bilder als ZIP (parallel extrahiert)
    // Rückwärtskompatibilität: includeImages bleibt für Standard-Endpoint
    const includeOcrImagesRaw = formData.get('includeOcrImages') as string | null;
    const includePageImagesRaw = formData.get('includePageImages') as string | null;
    const includeImagesRaw = formData.get('includeImages') as string | null; // Rückwärtskompatibilität
    
    // Für Mistral OCR: Beide Parameter standardmäßig true, wenn nicht explizit gesetzt
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includeOcrImages = includeOcrImagesRaw !== null 
      ? includeOcrImagesRaw === 'true'
      : (isMistralOcr ? true : (includeImagesRaw === 'true')); // Standard: true für Mistral OCR, sonst aus includeImages
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = includePageImagesRaw !== null
      ? includePageImagesRaw === 'true'
      : (isMistralOcr ? true : false); // Standard: true für Mistral OCR
    
    // Für Rückwärtskompatibilität: includeImages bleibt für Standard-Endpoint
    const includeImages = includeImagesRaw !== null ? includeImagesRaw === 'true' : false;
    
    const useCache = (formData.get('useCache') as string) ?? 'true';

    const policiesFromClient: PhasePolicies | undefined = (() => {
      try {
        const raw = formData.get('policies') as string | null;
        return raw ? (JSON.parse(raw) as PhasePolicies) : undefined;
      } catch {
        return undefined;
      }
    })();
    const policies = policiesFromClient || legacyToPolicies({ doExtractPDF: true });

    const repo = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repo.hashSecret(jobSecret);

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';

    const file = formData.get('file') as File | null;
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    // Upload-free Job Creation (Wizard/Storage-first):
    // Wenn kein `file` im Request enthalten ist, akzeptieren wir Name/MimeType separat,
    // damit das Job-UI & Tracing sinnvolle Werte hat. Die Binärdaten werden dann vom Worker
    // über `originalItemId` aus dem Storage geladen.
    const fileNameFromForm = (formData.get('fileName') as string) || undefined;
    const mimeTypeFromForm = (formData.get('mimeType') as string) || undefined;

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || mimeTypeFromForm || 'application/pdf',
        name: file?.name || fileNameFromForm,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeOcrImages, // Mistral OCR Bilder als Base64
        includePageImages, // Seiten-Bilder als ZIP
        includeImages: includeImages, // Rückwärtskompatibilität für Standard-Endpoint
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    };

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
    };

    await repo.create(job);

    const phases = { extract: policies.extract !== 'ignore', template: policies.metadata !== 'ignore', ingest: policies.ingest !== 'ignore' };
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeOcrImages,
      includePageImages,
      includeImages, // Rückwärtskompatibilität
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      policies,
    });

    // Trace initialisieren und Eingangsparameter protokollieren
    try {
      await repo.initializeTrace(jobId);
      await repo.traceAddEvent(jobId, {
        name: 'process_pdf_submit',
        attributes: {
          libraryId,
          fileName: correlation.source?.name,
          extractionMethod,
          targetLanguage,
          includeOcrImages,
          includePageImages,
          includeImages, // Rückwärtskompatibilität
          useCache: useCache === 'true',
          template: (formData.get('template') as string) || undefined,
          phases,
        }
      });
    } catch {}

    FileLogger.info('process-pdf', 'Job angelegt (queued, worker übernimmt)', { jobId, libraryId, userEmail });

    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}

    await repo.appendLog(jobId, { phase: 'enqueued', message: 'Job enqueued; worker will start it' } as unknown as Record<string, unknown>);
    return NextResponse.json({ status: 'accepted', job: { id: jobId } });
            } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
} 