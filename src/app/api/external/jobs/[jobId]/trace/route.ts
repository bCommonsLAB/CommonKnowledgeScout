import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

interface SpanOut {
  spanId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'skipped' | string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

interface EventOut {
  ts: string;
  spanId?: string;
  name: string;
  level?: 'info' | 'warn' | 'error' | string;
  message?: string;
  attributes?: Record<string, unknown>;
  eventId?: string;
  sequenceNo?: number;
  isDuplicate?: boolean;
  duplicateIndex?: number;
  duplicateCount?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const spansRaw = (job as unknown as { trace?: { spans?: unknown[] } }).trace?.spans;
    const eventsRaw = (job as unknown as { trace?: { events?: unknown[] } }).trace?.events;
    const spans: SpanOut[] = Array.isArray(spansRaw)
      ? spansRaw.map((s) => ({
          spanId: String((s as { spanId?: unknown }).spanId ?? ''),
          name: String((s as { name?: unknown }).name ?? ''),
          status: String((s as { status?: unknown }).status ?? ''),
          startedAt: (s as { startedAt?: unknown }).startedAt ? new Date(String((s as { startedAt?: unknown }).startedAt)).toISOString() : undefined,
          endedAt: (s as { endedAt?: unknown }).endedAt ? new Date(String((s as { endedAt?: unknown }).endedAt)).toISOString() : undefined,
          durationMs: (() => {
            const a = (s as { startedAt?: unknown }).startedAt ? Date.parse(String((s as { startedAt?: unknown }).startedAt)) : NaN;
            const b = (s as { endedAt?: unknown }).endedAt ? Date.parse(String((s as { endedAt?: unknown }).endedAt)) : NaN;
            return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, b - a) : undefined;
          })(),
        }))
      : [];
    const events: EventOut[] = Array.isArray(eventsRaw)
      ? eventsRaw.map((e) => ({
          ts: (e as { ts?: unknown }).ts ? new Date(String((e as { ts?: unknown }).ts)).toISOString() : new Date().toISOString(),
          spanId: (e as { spanId?: unknown }).spanId ? String((e as { spanId?: unknown }).spanId) : undefined,
          name: String((e as { name?: unknown }).name ?? ''),
          level: String((e as { level?: unknown }).level ?? 'info'),
          message: (e as { message?: unknown }).message ? String((e as { message?: unknown }).message) : undefined,
          attributes: (e as { attributes?: unknown }).attributes && typeof (e as { attributes?: unknown }).attributes === 'object' ? ((e as { attributes: Record<string, unknown> }).attributes) : undefined,
          eventId: (e as { eventId?: unknown }).eventId ? String((e as { eventId?: unknown }).eventId) : undefined,
        }))
      : [];

    // Analyse: Sequenznummern und Duplikate pro Span, sowie Lücken zwischen Spans (Root-Kinder)
    const bySpan = new Map<string, EventOut[]>();
    for (const ev of events) {
      const key = ev.spanId || 'root';
      const arr = bySpan.get(key) || [];
      arr.push(ev);
      bySpan.set(key, arr);
    }
    for (const [key, arr] of bySpan.entries()) {
      arr.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
      // Sequenznummern
      arr.forEach((e, i) => { e.sequenceNo = i + 1; });
      // Duplikate nach Name innerhalb desselben Spans erkennen
      const counts = new Map<string, number>();
      for (const e of arr) counts.set(e.name, (counts.get(e.name) || 0) + 1);
      const seenIndex = new Map<string, number>();
      for (const e of arr) {
        const c = counts.get(e.name) || 0;
        if (c > 1) {
          const idx = (seenIndex.get(e.name) || 0) + 1;
          seenIndex.set(e.name, idx);
          e.isDuplicate = true;
          e.duplicateIndex = idx;
          e.duplicateCount = c;
        }
      }
    }

    // Gaps: nur Kinder des Root-Spans ('job') betrachten
    const rootChildren = spans
      .filter((s) => (s as unknown as { parentSpanId?: string }).parentSpanId === 'job' || s.spanId === 'extract' || s.spanId === 'template' || s.spanId === 'store' || s.spanId === 'ingest')
      .sort((a, b) => (Date.parse(a.startedAt || '0') - Date.parse(b.startedAt || '0')));
    const gaps: Array<{ afterSpanId: string; beforeSpanId: string; gapMs: number; from: string; to: string }> = [];
    for (let i = 0; i < rootChildren.length - 1; i++) {
      const a = rootChildren[i];
      const b = rootChildren[i + 1];
      if (!a.endedAt || !b.startedAt) continue;
      const gap = Date.parse(b.startedAt) - Date.parse(a.endedAt);
      if (gap > 0) gaps.push({ afterSpanId: a.spanId, beforeSpanId: b.spanId, gapMs: gap, from: a.endedAt, to: b.startedAt });
    }

    // Mermaid Gantt generieren (nur 4 Hauptspans)
    const byId = Object.fromEntries(spans.map((s) => [s.spanId, s] as const));
    function tag(status: string): string {
      if (status === 'failed') return 'crit';
      if (status === 'running') return 'active';
      if (status === 'completed') return 'done';
      if (status === 'skipped') return 'done';
      return '';
    }
    function line(label: string, s?: SpanOut): string | null {
      if (!s || !s.startedAt) return null;
      const end = s.endedAt || new Date().toISOString();
      const t = tag(s.status);
      return `${label}  :${t ? t + ', ' : ''}${s.startedAt}, ${end}`;
    }
    const mermaidLines: string[] = [
      'gantt',
      '  dateFormat  YYYY-MM-DDTHH:mm:ss.SSS',
      '  axisFormat  %H:%M:%S',
      `  title Job ${jobId}`,
      '',
      '  section Extract',
      ...(line('Extract PDF        ', byId['extract']) ? [`  ${line('Extract PDF        ', byId['extract'])}`] : []),
      ...events.filter((e) => e.spanId === 'extract').map((e) => `  ${e.name} :milestone, ${e.ts}`),
      '',
      '  section Template',
      ...(line('Transform Template ', byId['template']) ? [`  ${line('Transform Template ', byId['template'])}`] : []),
      ...events.filter((e) => e.spanId === 'template').map((e) => `  ${e.name} :milestone, ${e.ts}`),
      '',
      '  section Store Twin',
      ...(line('Store Shadow Twin  ', byId['store']) ? [`  ${line('Store Shadow Twin  ', byId['store'])}`] : []),
      ...events.filter((e) => e.spanId === 'store').map((e) => `  ${e.name} :milestone, ${e.ts}`),
      '',
      '  section Ingest',
      ...(line('Ingest RAG         ', byId['ingest']) ? [`  ${line('Ingest RAG         ', byId['ingest'])}`] : []),
      ...events.filter((e) => e.spanId === 'ingest').map((e) => `  ${e.name} :milestone, ${e.ts}`),
    ];

    return NextResponse.json({
      jobId,
      spans,
      events,
      analysis: {
        gaps,
      },
      mermaid: { gantt: mermaidLines.join('\n') },
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


