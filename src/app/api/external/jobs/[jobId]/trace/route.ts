import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

interface SpanOut {
  spanId: string;
  parentSpanId?: string;
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
          parentSpanId: (s as { parentSpanId?: unknown }).parentSpanId ? String((s as { parentSpanId?: unknown }).parentSpanId) : undefined,
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

    // Normalisierung: store als Kind von template anzeigen, falls parentSpanId fehlt
    for (const s of spans) {
      if (s.spanId === 'store' && !s.parentSpanId) s.parentSpanId = 'template';
    }
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

    // Analyse: Globale Sequenznummern und robuste Duplikat‑Erkennung (inkl. message/attributes)
    events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
    const occurrences = new Map<string, number>();
    const groups = new Map<string, EventOut[]>();
    let seq = 0;
    for (const e of events) {
      seq += 1;
      e.sequenceNo = seq;
      const msg = e.name === 'callback_received' ? '' : (e.message || (typeof e.attributes?.message === 'string' ? String(e.attributes?.message) : ''));
      const progRaw = (e.attributes && typeof e.attributes === 'object') ? (e.attributes as Record<string, unknown>)['progress'] : undefined;
      const prog = typeof progRaw === 'number' ? progRaw : (typeof progRaw === 'string' ? Number(progRaw) : undefined);
      const key = `${e.spanId || 'root'}|${e.name}|${msg}|${Number.isFinite(prog as number) ? prog : ''}`;
      const count = (occurrences.get(key) || 0) + 1;
      occurrences.set(key, count);
      if (count > 1) {
        if (e.name === 'callback_received') continue; // Heartbeats/Callbacks nicht als Duplikate markieren
        const arr = groups.get(key) || [];
        arr.push(e);
        groups.set(key, arr);
      }
    }
    for (const arr of groups.values()) {
      for (let i = 0; i < arr.length; i++) {
        arr[i].isDuplicate = true;
        arr[i].duplicateIndex = i + 1;
        arr[i].duplicateCount = arr.length;
      }
    }

    // Gaps: nur Kinder des Root-Spans ('job') betrachten
    const rootChildren = spans
      .filter((s) => (s as unknown as { parentSpanId?: string }).parentSpanId === 'job')
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


