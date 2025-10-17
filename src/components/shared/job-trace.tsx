"use client";

import React from 'react';

interface SpanOut {
  spanId: string;
  name: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

interface EventOut {
  ts: string;
  spanId?: string;
  name: string;
  level?: string;
  message?: string;
  attributes?: Record<string, unknown>;
}

interface TraceResponse {
  jobId: string;
  spans: SpanOut[];
  events: EventOut[];
  mermaid: { gantt: string };
}

export function JobTrace({ jobId }: { jobId: string }) {
  const [data, setData] = React.useState<TraceResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const graphRef = React.useRef<HTMLDivElement | null>(null);
  const [renderedSvg, setRenderedSvg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}/trace`, { cache: 'no-store' });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          throw new Error(msg || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as TraceResponse;
        if (!active) return;
        setData(json);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        if (!active) return;
        setError(msg);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [jobId]);

  React.useEffect(() => {
    async function renderMermaid() {
      if (!data?.mermaid?.gantt) return;
      try {
        // Dynamisch laden – wenn nicht installiert, auf Fallback gehen
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });
        const id = `m-${jobId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
        const { svg } = await mermaid.render(id, data.mermaid.gantt);
        setRenderedSvg(svg);
      } catch {
        setRenderedSvg(null);
      }
    }
    void renderMermaid();
  }, [data?.mermaid?.gantt, jobId]);

  if (isLoading) return <div className="text-xs text-muted-foreground">Lade Trace…</div>;
  if (error) return <div className="text-xs text-red-600">{String(error)}</div>;
  if (!data) return <div className="text-xs text-muted-foreground">Kein Trace vorhanden.</div>;

  const spansById = new Map<string, SpanOut>(data.spans.map(s => [s.spanId, s]));
  const orderedPhases: Array<{ id: string; label: string }> = [
    { id: 'extract', label: 'Extract PDF' },
    { id: 'template', label: 'Transform Template' },
    { id: 'store', label: 'Store Shadow Twin' },
    { id: 'ingest', label: 'Ingest RAG' },
  ];

  function humanDuration(ms?: number): string {
    if (!ms || !Number.isFinite(ms)) return '';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
  }

  return (
    <div className="space-y-3">
      <div ref={graphRef}>
        {renderedSvg
          ? <div dangerouslySetInnerHTML={{ __html: renderedSvg }} />
          : (
            <pre className="text-xs overflow-auto p-2 bg-muted rounded">
{data.mermaid.gantt}
            </pre>
          )}
      </div>

      <div className="space-y-2">
        {orderedPhases.map((p) => {
          const span = spansById.get(p.id);
          const events = data.events.filter(e => e.spanId === p.id);
          return (
            <div key={p.id} className="border rounded p-2">
              <div className="text-sm font-medium">
                {p.label}
                {span?.status ? <span className="ml-2 text-xs text-muted-foreground">({span.status}{span?.durationMs ? `, ${humanDuration(span.durationMs)}` : ''})</span> : null}
              </div>
              {events.length > 0 ? (
                <ul className="mt-1 text-xs list-disc pl-4">
                  {events.map((e, idx) => (
                    <li key={idx}>
                      <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                      <span className="ml-2">{e.name}</span>
                      {e.message ? <span className="ml-2 text-muted-foreground">{e.message}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">Keine Events</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


