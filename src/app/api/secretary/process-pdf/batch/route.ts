import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { legacyToPolicies } from '@/lib/processing/phase-policy';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeOcrImages?: boolean; // Mistral OCR Bilder als Base64
    includePageImages?: boolean; // Seiten-Bilder als ZIP
    includeImages?: boolean; // Rückwärtskompatibilität
    useCache?: boolean;
    template?: string;
    policies?: import('@/lib/processing/phase-policy').PhasePolicies;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const extractionMethod = options?.extractionMethod || 'native';
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includeOcrImages = options?.includeOcrImages !== undefined
      ? options.includeOcrImages
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includePageImages = options?.includePageImages !== undefined
      ? options.includePageImages
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    
    // Diagnose: Eingehende Policies loggen (einmal pro Batch)
    FileLogger.info('process-pdf-batch', 'Incoming batch options', { 
      libraryId, 
      batchName, 
      policiesIn: options?.policies,
      extractionMethod,
      includeOcrImages,
      includePageImages,
      isMistralOcr
    });
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Eindeutige Batch-ID generieren
    const batchId = crypto.randomUUID();

    // Phase 1: Alle Jobs minimal in DB anlegen (ohne PDFs zu laden)
    const repo = new ExternalJobsRepository();
    const createdJobIds: string[] = [];
    for (const it of items) {
      try {
        const jobId = crypto.randomUUID();
        const jobSecret = crypto.randomBytes(24).toString('base64url');
        const jobSecretHash = repo.hashSecret(jobSecret);
        const policiesEffective = options?.policies || legacyToPolicies({ doExtractPDF: true });
        // Leite phases aus policies ab (wie in process-pdf/route.ts Zeile 129)
        // WICHTIG: Dies stellt sicher, dass beide Workflows (manuell vs. Batch) konsistent sind
        const phases = { 
          extract: policiesEffective.extract !== 'ignore', 
          template: policiesEffective.metadata !== 'ignore', 
          ingest: policiesEffective.ingest !== 'ignore' 
        };
        await repo.create({
          jobId,
          jobSecretHash,
          job_type: 'pdf',
          operation: 'extract',
          worker: 'secretary',
          status: 'queued',
          libraryId,
          userEmail,
          correlation: {
            jobId,
            libraryId,
            source: { mediaType: 'pdf', mimeType: it.mimeType || 'application/pdf', name: it.name || 'document.pdf', itemId: it.fileId, parentId: it.parentId },
            options: {
              targetLanguage: options?.targetLanguage || 'de',
              extractionMethod: extractionMethod,
              includeOcrImages: includeOcrImages,
              includePageImages: includePageImages,
              includeImages: options?.includeImages ?? false, // Rückwärtskompatibilität
              useCache: options?.useCache ?? true,
            },
            batchId,
            batchName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            targetLanguage: options?.targetLanguage || 'de',
            extractionMethod: extractionMethod,
            includeOcrImages: includeOcrImages,
            includePageImages: includePageImages,
            includeImages: options?.includeImages ?? false, // Rückwärtskompatibilität
            useCache: options?.useCache ?? true,
            template: options?.template,
            // Leite phases aus policies ab (konsistent mit process-pdf/route.ts)
            phases,
            // Nur neue Policies
            policies: policiesEffective,
            batchId,
            batchName,
          }
        } as unknown as Parameters<ExternalJobsRepository['create']>[0]);
        // Diagnose: Übernommene Policies protokollieren
        await repo.appendLog(jobId, { phase: 'batch_job_created', details: { policies: policiesEffective } } as unknown as Record<string, unknown>);
        createdJobIds.push(jobId);
      } catch (e) {
        FileLogger.error('process-pdf-batch', 'Job-Anlage fehlgeschlagen', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Phase 2 entfällt: Der zentrale Worker claimt und startet die Jobs.
    FileLogger.info('process-pdf-batch', 'Jobs enqueued; Worker übernimmt Start', { count: createdJobIds.length, batchId, batchName });

    // Sofortige Antwort: Anzahl angelegter Jobs
    return NextResponse.json({ ok: true, batchId, batchName, created: createdJobIds.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}


