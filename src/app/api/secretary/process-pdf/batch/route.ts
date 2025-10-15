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
    includeImages?: boolean;
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
    // Diagnose: Eingehende Policies loggen (einmal pro Batch)
    FileLogger.info('process-pdf-batch', 'Incoming batch options', { libraryId, batchName, policiesIn: options?.policies });
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
              extractionMethod: options?.extractionMethod || 'native',
              includeImages: options?.includeImages ?? false,
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
            extractionMethod: options?.extractionMethod || 'native',
            includeImages: options?.includeImages ?? false,
            useCache: options?.useCache ?? true,
            template: options?.template,
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

    // Phase 2: Verarbeitung asynchron starten (Concurrency 5) via Retry‑Route
    const concurrency = 5;
    (async () => {
      let idx = 0;
      const runner = async () => {
        while (true) {
          const i = idx++;
          if (i >= createdJobIds.length) break;
          const jobId = createdJobIds[i];
          try {
            const res = await fetch(new URL(`/api/external/jobs/${jobId}/retry`, request.url).toString(), {
              method: 'POST',
              headers: { 'Cookie': request.headers.get('cookie') || '' }
            });
            if (!res.ok) {
              const msg = await res.text().catch(() => res.statusText);
              FileLogger.error('process-pdf-batch', 'Retry-Start fehlgeschlagen', { jobId, msg });
            }
          } catch (err) {
            FileLogger.error('process-pdf-batch', 'Retry-Start Exception', { jobId, err: err instanceof Error ? err.message : String(err) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, createdJobIds.length) }, () => runner()));
      FileLogger.info('process-pdf-batch', 'Asynchroner Start abgeschlossen', { count: createdJobIds.length, batchId, batchName });
    })().catch(() => {});

    // Sofortige Antwort: Anzahl angelegter Jobs
    return NextResponse.json({ ok: true, batchId, batchName, created: createdJobIds.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}


