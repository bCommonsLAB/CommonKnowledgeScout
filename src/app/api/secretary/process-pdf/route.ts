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
    const extractionMethod = (formData.get('extractionMethod') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
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

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
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
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      policies,
    });

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