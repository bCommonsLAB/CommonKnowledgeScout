import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import type { ExternalJob } from '@/types/external-job';

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
    const { items, total, page: curPage, limit: curLimit } = await repo.listByUserEmail(userEmail, { page, limit });

    const mapped = items.map((j: ExternalJob) => {
      const last = Array.isArray(j.logs) && j.logs.length > 0 ? j.logs[j.logs.length - 1] : undefined;
      return {
        jobId: j.jobId,
        status: j.status,
        operation: j.operation,
        worker: j.worker,
        jobType: j.job_type,
        fileName: j.correlation?.source?.name,
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


