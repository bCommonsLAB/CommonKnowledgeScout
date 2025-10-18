import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

function safe(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (obj as any)[key];
}

function fmtIso(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return new NextResponse('Nicht authentifiziert', { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return new NextResponse('Benutzer-E-Mail nicht verfügbar', { status: 403 });

    const { jobId } = await params;
    if (!jobId) return new NextResponse('jobId erforderlich', { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return new NextResponse('Job nicht gefunden', { status: 404 });
    if ((safe(job, 'userEmail') as string | undefined) !== userEmail) return new NextResponse('Forbidden', { status: 403 });

    const status = String(safe(job, 'status') ?? 'unknown');
    const jobType = String(safe(job, 'job_type') ?? safe(job, 'jobType') ?? '');
    const fileName = String(safe(job, 'correlation')?.['source']?.['name'] ?? safe(job, 'fileName') ?? '');
    const batchName = String(safe(job, 'batchName') ?? '');
    const createdAt = fmtIso(String(safe(job, 'createdAt') ?? ''));
    const updatedAt = fmtIso(String(safe(job, 'updatedAt') ?? ''));
    const steps = (safe(job, 'steps') as unknown[]) || [];
    const trace = (safe(job, 'trace') as { spans?: unknown[]; events?: unknown[] }) || {};
    const spans = Array.isArray(trace.spans) ? trace.spans : [];
    const events = Array.isArray(trace.events) ? trace.events : [];
    // Sequenz- und Duplikat-Analyse wie im Trace-Endpoint
    const evs = events.map((e) => ({
      ts: fmtIso(String((e as { ts?: unknown }).ts || '')) || new Date().toISOString(),
      spanId: (e as { spanId?: unknown }).spanId ? String((e as { spanId?: unknown }).spanId) : undefined,
      name: String((e as { name?: unknown }).name ?? ''),
      level: String((e as { level?: unknown }).level ?? 'info'),
      message: (e as { message?: unknown }).message ? String((e as { message?: unknown }).message) : undefined,
      attributes: (e as { attributes?: unknown }).attributes && typeof (e as { attributes?: unknown }).attributes === 'object' ? ((e as { attributes: Record<string, unknown> }).attributes) : undefined,
      eventId: (e as { eventId?: unknown }).eventId ? String((e as { eventId?: unknown }).eventId) : undefined,
    }));
    const bySpan = new Map<string, typeof evs>();
    for (const ev of evs) {
      const key = ev.spanId || 'root';
      const arr = bySpan.get(key) || [];
      arr.push(ev);
      bySpan.set(key, arr);
    }
    for (const [, arr] of bySpan.entries()) {
      arr.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
      const counts = new Map<string, number>();
      arr.forEach((e) => counts.set(e.name, (counts.get(e.name) || 0) + 1));
      let seq = 0; const seen = new Map<string, number>();
      arr.forEach((e) => {
        seq += 1; (e as { sequenceNo?: number }).sequenceNo = seq;
        const c = counts.get(e.name) || 0;
        if (c > 1) {
          const idx = (seen.get(e.name) || 0) + 1; seen.set(e.name, idx);
          (e as { isDuplicate?: boolean }).isDuplicate = true;
          (e as { duplicateIndex?: number }).duplicateIndex = idx;
          (e as { duplicateCount?: number }).duplicateCount = c;
        }
      });
    }

    function durationMs(a?: string, b?: string): number | null {
      if (!a || !b) return null;
      const start = Date.parse(a);
      const end = Date.parse(b);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      return Math.max(0, end - start);
    }

    const mdLines: string[] = [];
    mdLines.push(`# Secretary Job ${jobId}`);
    mdLines.push('');
    mdLines.push(`- Status: ${status}`);
    if (jobType) mdLines.push(`- Job-Typ: ${jobType}`);
    if (fileName) mdLines.push(`- Datei: ${fileName}`);
    if (batchName) mdLines.push(`- Batch: ${batchName}`);
    if (createdAt) mdLines.push(`- Erstellt: ${createdAt}`);
    if (updatedAt) mdLines.push(`- Aktualisiert: ${updatedAt}`);
    // Worker-Zusammenfassung aus Event-Attributen ermitteln
    const workerIds = Array.from(new Set(
      evs
        .map((e) => (e.attributes && typeof e.attributes === 'object' ? (e.attributes as Record<string, unknown>)['workerId'] : undefined))
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    ));
    if (workerIds.length) mdLines.push(`- Worker: ${workerIds.join(', ')}`);
    mdLines.push('');

    if (Array.isArray(steps) && steps.length > 0) {
      mdLines.push('## Schritte');
      for (const s of steps) {
        const name = String(s && typeof s === 'object' ? (s as { name?: unknown }).name ?? '' : '');
        const st = String(s && typeof s === 'object' ? (s as { status?: unknown }).status ?? '' : '');
        mdLines.push(`- ${name || 'step'}: ${st}`);
      }
      mdLines.push('');
    }

    mdLines.push('## Spans');
    for (const s of spans as Array<Record<string, unknown>>) {
      const sid = String(s.spanId ?? '');
      const parent = String(s.parentSpanId ?? '') || null;
      const name = String(s.name ?? '');
      const st = String(s.status ?? '');
      const startedAt = fmtIso(String(s.startedAt ?? ''));
      const endedAt = fmtIso(String(s.endedAt ?? ''));
      const dur = durationMs(startedAt, endedAt);
      mdLines.push(`- ${name} (${sid}${parent ? ` ← ${parent}` : ''}): ${st}${dur !== null ? ` · ${Math.round(dur / 1000)}s` : ''}`);
    }
    mdLines.push('');

    mdLines.push('## Events');
    for (const e of evs) {
      const sid = e.spanId || '';
      const seq = typeof (e as { sequenceNo?: number }).sequenceNo === 'number' ? (e as { sequenceNo: number }).sequenceNo : undefined;
      const seqStr = seq ? `#${seq} ` : '';
      const base = `- ${seqStr}[${e.level}] ${e.ts}${sid ? ` · ${sid}` : ''} · ${e.name}`;
      const dup = (e as { isDuplicate?: boolean }).isDuplicate && typeof (e as { duplicateIndex?: number }).duplicateIndex === 'number' && typeof (e as { duplicateCount?: number }).duplicateCount === 'number'
        ? ` (dup ${(e as { duplicateIndex: number }).duplicateIndex}/${(e as { duplicateCount: number }).duplicateCount})` : '';
      const msg = e.message ? `: ${e.message}` : '';
      mdLines.push(base + dup + msg);
      // Tooltip-Details: Attribute vollständig (z. B. workerId, status etc.)
      if (e.attributes && Object.keys(e.attributes).length > 0) {
        mdLines.push('');
        mdLines.push('  ```json');
        mdLines.push(`  ${JSON.stringify(e.attributes, null, 2).split('\n').join('\n  ')}`);
        mdLines.push('  ```');
      }
    }

    // Gaps ähnlich wie im Trace-Endpoint
    const spanObjs = spans as Array<Record<string, unknown>>;
    const roots = spanObjs
      .map((s) => ({
        spanId: String(s.spanId ?? ''), parentSpanId: s.parentSpanId ? String(s.parentSpanId) : undefined,
        startedAt: fmtIso(String(s.startedAt ?? '')), endedAt: fmtIso(String(s.endedAt ?? '')),
      }))
      .filter(Boolean)
      .sort((a, b) => Date.parse(a.startedAt || '') - Date.parse(b.startedAt || ''));
    const gaps: Array<{ after: string; before: string; gapSec: string }> = [];
    for (let i = 0; i < roots.length - 1; i++) {
      const a = roots[i]; const b = roots[i+1];
      if (!a.endedAt || !b.startedAt) continue;
      const gap = Date.parse(b.startedAt) - Date.parse(a.endedAt);
      if (gap > 0) gaps.push({ after: a.spanId, before: b.spanId, gapSec: (gap/1000).toFixed(2) });
    }
    if (gaps.length) {
      mdLines.push('');
      mdLines.push('## Analyse');
      for (const g of gaps) mdLines.push(`- Gap ${g.after} → ${g.before}: ${g.gapSec} s`);
    }

    const body = mdLines.join('\n');
    return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch {
    return new NextResponse('Unerwarteter Fehler', { status: 500 });
  }
}


