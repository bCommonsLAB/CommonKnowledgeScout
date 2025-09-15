import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const url = new URL(request.url);
    const libraryId = url.searchParams.get('libraryId') || undefined;
    const batchName = url.searchParams.get('batchName') || undefined;
    const batchId = url.searchParams.get('batchId') || undefined;

    const repo = new ExternalJobsRepository();
    const counters = await repo.countByStatus(userEmail, { libraryId, batchName, batchId });
    return NextResponse.json({ counters });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


