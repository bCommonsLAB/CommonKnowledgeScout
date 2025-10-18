"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SpanStatus = "running" | "completed" | "failed" | "skipped" | string;

interface SpanOut {
  spanId: string;
  parentSpanId?: string;
  name: string;
  status: SpanStatus;
  startedAt?: string;
  endedAt?: string;
  attributes?: Record<string, unknown>;
}

interface EventOut {
  ts: string;
  spanId?: string | null;
  name: string;
  level?: "info" | "warn" | "error" | string;
  message?: string | null;
  attributes?: Record<string, unknown>;
  eventId?: string;
  sequenceNo?: number;
  isDuplicate?: boolean;
  duplicateIndex?: number;
  duplicateCount?: number;
}

interface TraceResponse {
  jobId: string;
  spans: SpanOut[];
  events: EventOut[];
  analysis?: { gaps?: Array<{ afterSpanId: string; beforeSpanId: string; gapMs: number; from: string; to: string }> };
}

export function TraceViewer({ jobId }: { jobId: string }) {
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError(null);
        const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}/trace`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        const json = (await res.json()) as { jobId: string; spans: SpanOut[]; events: EventOut[] };
        if (!active) return;
        setTrace({ jobId: json.jobId, spans: json.spans || [], events: json.events || [] });
        // Standard: Nur Root-Spans (z. B. "job") expandieren → 3. Ebene (Events) bleibt zu
        const rootOnly = new Set<string>();
        for (const s of (json.spans || [])) if (s.name === 'job') rootOnly.add(s.spanId);
        setExpandedSpans(rootOnly);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    }
    void load();
    return () => { active = false; };
  }, [jobId]);

  const allTimestamps = useMemo(() => {
    if (!trace) return [] as number[];
    const ts: number[] = [];
    for (const e of trace.events) {
      const t = Date.parse(e.ts);
      if (Number.isFinite(t)) ts.push(t);
    }
    for (const s of trace.spans) {
      const a = s.startedAt ? Date.parse(s.startedAt) : NaN;
      const b = s.endedAt ? Date.parse(s.endedAt) : NaN;
      if (Number.isFinite(a)) ts.push(a);
      if (Number.isFinite(b)) ts.push(b);
    }
    return ts;
  }, [trace]);

  const minTime = useMemo(() => (allTimestamps.length ? Math.min(...allTimestamps) : Date.now()), [allTimestamps]);
  const maxTime = useMemo(() => (allTimestamps.length ? Math.max(...allTimestamps) : Date.now()), [allTimestamps]);
  const timeRange = Math.max(1, maxTime - minTime);

  const toggleSpan = (spanId: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId); else next.add(spanId);
      return next;
    });
  };

  const getTimePosition = (timestamp?: string) => {
    if (!timestamp) return 0;
    const time = Date.parse(timestamp);
    return Math.max(0, Math.min(100, ((time - minTime) / timeRange) * 100));
  };

  const getSpanDuration = (span: SpanOut) => {
    if (!span.endedAt || !span.startedAt) return null;
    const start = Date.parse(span.startedAt);
    const end = Date.parse(span.endedAt);
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
  };

  const getSpanWidth = (span: SpanOut) => {
    if (!span.startedAt) return 0;
    const endVisible = (() => {
      // Wenn Events mit ts zwischen span.startedAt und späterem Zeitpunkt existieren, dehnen wir den Balken bis zum letzten Event
      const lastEventTs = Math.max(
        0,
        ...((trace?.events || []).filter(e => (e.spanId ?? undefined) === span.spanId).map(e => Date.parse(e.ts))).filter(n => Number.isFinite(n))
      );
      const spanEnd = span.endedAt ? Date.parse(span.endedAt) : lastEventTs || Date.now();
      return Math.max(spanEnd, lastEventTs || spanEnd);
    })();
    const start = Date.parse(span.startedAt);
    const end = endVisible;
    return Math.max(0, Math.min(100, ((end - start) / timeRange) * 100));
  };

  const formatDuration = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const time = Date.parse(timestamp);
    const relativeMs = time - minTime;
    return `${(relativeMs / 1000).toFixed(2)} s`;
  };

  const hasError = (spanId: string | null | undefined) => trace?.events.some((e) => (e.spanId ?? null) === (spanId ?? null) && (e.level === "error")) || false;
  const getSpanEvents = (spanId: string) => (trace?.events.filter((e) => (e.spanId ?? undefined) === spanId && e.name !== 'callback_received') || []);

  const buildSpanTree = useMemo(() => {
    const spanMap = new Map<string, SpanOut>();
    const roots: SpanOut[] = [];
    const children = new Map<string, SpanOut[]>();
    for (const s of trace?.spans || []) spanMap.set(s.spanId, s);
    for (const s of trace?.spans || []) {
      if (!s.parentSpanId) roots.push(s);
      else {
        const arr = children.get(s.parentSpanId) || [];
        arr.push(s);
        children.set(s.parentSpanId, arr);
      }
    }
    return { roots, children };
  }, [trace]);

  const renderEvent = (event: EventOut, depth: number) => {
    const isError = event.level === "error";
    const position = getTimePosition(event.ts);
    // Sichere, stabile Keys: eventId bevorzugen
    const key = event.eventId || `${event.ts}-${event.name}-${depth}-${event.spanId ?? 'root'}-${event.message ? event.message.length : 0}`;
    const attrMessage = event.attributes && typeof event.attributes === 'object' ? String((event.attributes as Record<string, unknown>)['message'] || '') : '';
    const displayTextRaw = (event.message && event.message.trim().length > 0)
      ? event.message
      : (attrMessage && attrMessage.trim().length > 0)
        ? attrMessage
        : event.name;
    const displayText = sanitizeForInlineDisplay(displayTextRaw);
    return (
      <TooltipProvider key={key}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "relative flex items-center gap-2 py-0.5 px-2 cursor-default transition-colors hover:bg-accent/30 border-b border-border/30",
                isError && "bg-destructive/10 hover:bg-destructive/20",
                event.isDuplicate && "bg-amber-100/60 hover:bg-amber-100/80",
              )}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-0.5 opacity-40",
                  isError ? "bg-destructive" : "bg-primary",
                )}
                style={{ left: `${position}%` }}
              />
              {event.sequenceNo ? (
                <span className="text-[10px] font-mono text-muted-foreground min-w-[20px] text-right">#{event.sequenceNo}</span>
              ) : null}
              <span className={cn("text-xs font-mono flex-1 min-w-0 truncate max-w-[22rem]", isError ? "text-destructive" : "text-foreground")}>{displayText}
                {event.isDuplicate && typeof event.duplicateIndex === 'number' && typeof event.duplicateCount === 'number' ? (
                  <span className="ml-2 inline-flex items-center rounded px-1 py-0.5 text-[10px] bg-amber-200 text-amber-900 border border-amber-300">{event.duplicateIndex}/{event.duplicateCount}</span>
                ) : null}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0 min-w-[60px] text-right">{formatTime(event.ts)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{event.name}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded", isError ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary")}>{event.level || "info"}</span>
              </div>
              {event.message ? <p className="text-sm text-muted-foreground">{event.message}</p> : null}
              {event.attributes && Object.keys(event.attributes).length > 0 ? (
                <div className="text-xs">
                  <div className="font-semibold mb-1">Attribute:</div>
                  <pre className="bg-muted p-2 rounded overflow-auto max-h-40">{JSON.stringify(event.attributes, null, 2)}</pre>
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">{formatTime(event.ts)}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderSpan = (span: SpanOut, depth: number) => {
    const isExpanded = expandedSpans.has(span.spanId);
    const events = getSpanEvents(span.spanId);
    const children = (buildSpanTree.children.get(span.spanId) || []);
    const spanHasError = hasError(span.spanId);
    const duration = getSpanDuration(span);
    const position = getTimePosition(span.startedAt);
    const width = getSpanWidth(span);
    return (
      <div key={span.spanId} className="relative">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative flex items-center gap-2 py-0.5 px-2 cursor-pointer transition-colors hover:bg-accent/50 border-b border-border/50",
                  spanHasError && "bg-destructive/10 hover:bg-destructive/20",
                  span.status === "running" && "bg-primary/5",
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => toggleSpan(span.spanId)}
              >
                <div
                  className={cn(
                    "absolute top-0 bottom-0 opacity-15 rounded-sm",
                    spanHasError ? "bg-destructive" : span.status === "running" ? "bg-amber-500" : "bg-green-500",
                  )}
                  style={{ left: `${position}%`, width: `${width}%` }}
                />
                <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                  {(events.length > 0 || children.length > 0) && (isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  ))}
                </div>
                <div className="flex-shrink-0">
                  {spanHasError ? (
                    <AlertCircle className="w-3 h-3 text-destructive" />
                  ) : span.status === "completed" ? (
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                  ) : (
                    <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                  )}
                </div>
                <span className={cn("text-xs font-semibold flex-1", spanHasError ? "text-destructive" : "text-foreground")}>{span.name}</span>
                {duration !== null ? (
                  <span className="text-[10px] text-muted-foreground font-mono min-w-[60px] text-right">{formatDuration(duration)}</span>
                ) : null}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  span.status === "completed" && "bg-green-100 text-green-700",
                  span.status === "running" && "bg-amber-100 text-amber-700",
                  spanHasError && "bg-destructive/20 text-destructive",
                )}>{spanHasError ? "error" : span.status}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{span.name}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded",
                    span.status === "completed" && "bg-green-100 text-green-700",
                    span.status === "running" && "bg-amber-100 text-amber-700",
                  )}>{span.status}</span>
                </div>
                <div className="text-xs space-y-1">
                  <div>Start: {formatTime(span.startedAt)}</div>
                  {span.endedAt ? <div>Ende: {formatTime(span.endedAt)}</div> : null}
                  {duration !== null ? <div>Dauer: {formatDuration(duration)}</div> : null}
                </div>
                {events.length ? <div className="text-xs text-muted-foreground">{events.length} Event{events.length !== 1 ? "s" : ""}</div> : null}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isExpanded ? (
              <div className="space-y-0">
            {/* Zuerst Child-Spans, dann Events, damit die 3. Ebene kompakt bleibt */}
            {children.map((c) => renderSpan(c, depth + 1))}
            {events.map((e) => renderEvent(e, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderGap = (gap: { afterSpanId: string; beforeSpanId: string; gapMs: number; from: string; to: string }) => {
    const left = getTimePosition(gap.from);
    const right = getTimePosition(gap.to);
    const width = Math.max(0, right - left);
    return (
      <div key={`gap-${gap.afterSpanId}-${gap.beforeSpanId}-${gap.from}`} className="relative">
        <div className="relative flex items-center gap-2 py-0.5 px-2 border-b border-border/50" style={{ paddingLeft: `8px` }}>
          <div className="absolute top-0 bottom-0 bg-red-300/60 rounded-sm" style={{ left: `${left}%`, width: `${width}%` }} />
          <span className="text-xs font-semibold text-red-700">gap {gap.afterSpanId} → {gap.beforeSpanId}</span>
          <span className="text-[10px] text-muted-foreground font-mono ml-auto">{(gap.gapMs/1000).toFixed(2)} s</span>
        </div>
      </div>
    );
  };

  if (error) return <div className="text-xs text-red-600">{error}</div>;
  if (!trace) return <div className="text-xs text-muted-foreground">Kein Trace gefunden.</div>;

  const rootEvents = trace.events.filter((e) => (e.spanId ?? null) === null);
  const rootSpans = (trace.spans || []).filter((s) => !s.parentSpanId);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="border-b border-border px-3 py-1.5 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-semibold text-foreground">Trace Timeline</h2>
            <span className="text-[10px] text-muted-foreground">{trace.spans.length} Spans · {trace.events.length} Events</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">Dauer: {formatDuration(timeRange)}</div>
        </div>
      </div>
      <div className="space-y-0">
        {rootEvents.map((e) => renderEvent(e, 0))}
        {Array.isArray(trace.analysis?.gaps) && trace.analysis!.gaps!.length > 0 ? (
          trace.analysis!.gaps!.map((g) => renderGap(g))
        ) : null}
        {rootSpans.map((s) => renderSpan(s, 0))}
      </div>
    </div>
  );
}

function sanitizeForInlineDisplay(text?: string | null): string {
  if (!text) return "";
  return String(text).replace(/\s+/g, " ").trim();
}


