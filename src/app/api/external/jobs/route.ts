/**
 * @fileoverview External Jobs List API Route - Job Query Endpoint
 * 
 * @description
 * Endpoint for querying external jobs with filtering and pagination. Supports filtering by
 * status, batch, library, source item, result item, and text search. Returns paginated
 * job lists with metadata. Used by UI components for displaying job history and status.
 * 
 * @module external-jobs
 * 
 * @exports
 * - GET: Lists external jobs with filtering and pagination
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/external/jobs
 * - src/components/event-monitor: Event monitor components query jobs
 * - src/app/event-monitor: Event monitor pages query jobs
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository for queries
 * - @/types/external-job: External job type definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import type { ExternalJob, ExternalJobStatus } from '@/types/external-job';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '20')));

    const repo = new ExternalJobsRepository();
    const parsedUrl = new URL(request.url);
    const bySourceItemId = parsedUrl.searchParams.get('bySourceItemId');
    const byResultItemId = parsedUrl.searchParams.get('byResultItemId');
    const libraryId = parsedUrl.searchParams.get('libraryId') || '';

    if (bySourceItemId && libraryId) {
      const job = await repo.findLatestBySourceItem(userEmail, libraryId, bySourceItemId);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }
    if (byResultItemId) {
      const job = await repo.findLatestByResultItem(userEmail, byResultItemId);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }
    const bySourceName = parsedUrl.searchParams.get('bySourceName');
    if (bySourceName && libraryId) {
      const job = await repo.findLatestBySourceName(userEmail, libraryId, bySourceName);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }

    const statusParam = parsedUrl.searchParams.get('status');
    const batchName = parsedUrl.searchParams.get('batchName') || undefined;
    const batchId = parsedUrl.searchParams.get('batchId') || undefined;
    const query = parsedUrl.searchParams.get('q') || undefined;
    const statuses: ExternalJobStatus[] | undefined = statusParam
      ? (statusParam.split(',').map(s => s.trim()).filter(Boolean) as ExternalJobStatus[])
      : undefined;

    const { items, total, page: curPage, limit: curLimit } = await repo.listByUserWithFilters(userEmail, {
      page,
      limit,
      status: statuses,
      batchName,
      batchId,
      libraryId,
      q: query,
    });

    const mapped = items.map((j: ExternalJob) => {
      const last = Array.isArray(j.logs) && j.logs.length > 0 ? j.logs[j.logs.length - 1] : undefined;
      return {
        jobId: j.jobId,
        status: j.status,
        operation: j.operation,
        worker: j.worker,
        jobType: j.job_type,
        fileName: j.correlation?.source?.name,
        sourceItemId: j.correlation?.source?.itemId,
        sourceParentId: j.correlation?.source?.parentId,
        shadowTwinFolderId: j.shadowTwinState?.shadowTwinFolderId, // Shadow-Twin-Verzeichnis-ID (falls vorhanden)
        resultItemId: j.result?.savedItemId, // erzeugte Datei (z.B. transformiertes Markdown)
        libraryId: j.libraryId,
        batchName: j.correlation?.batchName,
        batchId: j.correlation?.batchId,
        updatedAt: j.updatedAt,
        createdAt: j.createdAt,
        lastMessage: typeof last?.message === 'string' ? last.message : undefined,
        lastProgress: typeof last?.progress === 'number' ? last.progress : undefined,
      };
    });

    return NextResponse.json({ page: curPage, limit: curLimit, total, items: mapped });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


