import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const body = await request.json().catch(() => ({})) as { status?: string; batchName?: string; batchId?: string };
    const status = (body.status || '').trim();
    const batchName = typeof body.batchName === 'string' ? body.batchName : undefined;
    const batchId = typeof body.batchId === 'string' ? body.batchId : undefined;

    // Hole gefilterte Jobs Seite für Seite und triggere Retry (nur queued/failed; running wird übersprungen)
    const retried: string[] = [];
    const skipped: string[] = [];
    let page = 1;
    while (true) {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);
      if (batchName) params.set('batchName', batchName);
      if (batchId) params.set('batchId', batchId);
      const res = await fetch(new URL(`/api/external/jobs?${params.toString()}`, request.url).toString(), { cache: 'no-store', headers: { 'Cookie': request.headers.get('cookie') || '' } });
      if (!res.ok) break;
      const json = await res.json();
      const items: Array<{ jobId: string; status: string }> = Array.isArray(json.items) ? json.items : [];
      for (const it of items) {
        if (it.status === 'running') { skipped.push(it.jobId); continue; }
        const r = await fetch(new URL(`/api/external/jobs/${it.jobId}/retry`, request.url).toString(), { method: 'POST', headers: { 'Cookie': request.headers.get('cookie') || '' } });
        if (r.ok) retried.push(it.jobId); else skipped.push(it.jobId);
      }
      if (items.length < 50) break;
      page += 1;
    }
    return NextResponse.json({ ok: true, retriedCount: retried.length, skippedCount: skipped.length, retried, skipped });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


