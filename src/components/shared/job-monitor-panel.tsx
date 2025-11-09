"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TraceViewer } from '@/components/shared/trace-viewer';
import { FileText, FileAudio, FileVideo, Image as ImageIcon, File as FileIcon, FileType2, RefreshCw, Ban, Activity, Copy, Trash2 } from "lucide-react";

interface JobListItem {
  jobId: string;
  status: string;
  operation?: string;
  worker?: string;
  jobType?: string;
  fileName?: string;
  updatedAt?: string;
  createdAt?: string;
  lastMessage?: string;
  lastProgress?: number;
}

interface JobUpdateEvent {
  type: 'job_update';
  jobId: string;
  status: string;
  phase?: string;
  progress?: number;
  message?: string;
  updatedAt: string;
  jobType?: string;
  fileName?: string;
  sourceItemId?: string;
  refreshFolderId?: string;
}

function formatRelative(dateIso?: string): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `vor ${days}d`;
}

function formatClock(dateIso?: string): string {
  if (!dateIso) return '';
  const d = new Date(dateIso);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function truncateMiddle(input?: string, max: number = 40): string {
  if (!input) return '';
  if (input.length <= max) return input;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${input.slice(0, head)}…${input.slice(input.length - tail)}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [serverCounts, setServerCounts] = useState<{ queued: number; running: number; completed: number; failed: number; pendingStorage: number; total: number } | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);
  const [workerStatus, setWorkerStatus] = useState<{ state: 'running' | 'stopped'; stats?: { processed?: number; errors?: number; lastTickAt?: number }; concurrency?: number; intervalMs?: number } | null>(null);
  const [openTraces, setOpenTraces] = useState<Set<string>>(new Set());
  const toggleTrace = (jobId: string) => {
    setOpenTraces(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  // Worker wird nicht mehr automatisch gestartet; nur noch über die Controls

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  // Serverseitige Zähler laden (gesamt, optional gefiltert nach Batch)
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    let active = true;
    async function loadCounts() {
      try {
        const params = new URLSearchParams();
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs/counters?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        setServerCounts(json.counters || null);
      } catch {}
    }
    void loadCounts();
    const t = setInterval(loadCounts, 5000);
    return () => { active = false; clearInterval(t); };
  }, [isOpen, batchFilter, liveUpdates]);

  // Worker-Status laden
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    let active = true;
    async function loadWorker() {
      try {
        const res = await fetch('/api/external/jobs/worker', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        setWorkerStatus(json);
      } catch {}
    }
    void loadWorker();
    const t = setInterval(loadWorker, 5000);
    return () => { active = false; clearInterval(t); };
  }, [isOpen, liveUpdates]);

  const refreshNow = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, statusFilter, batchFilter]);

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          // Terminal: failed sofort anwenden und weitere Progress-Events für diesen Job ignorieren (durch Statusüberschreibung)
          if (evt.status === 'failed' || evt.phase === 'failed') {
            setItems(prev => {
              const idx = prev.findIndex(p => p.jobId === evt.jobId);
              if (idx < 0) return prev;
              const updated = { ...prev[idx], status: 'failed', lastMessage: evt.message ?? prev[idx].lastMessage, updatedAt: evt.updatedAt };
              const next = [...prev];
              next[idx] = updated;
              next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
              return next;
            });
            if (evt.sourceItemId && evt.status) {
              upsertJobStatus({ itemId: evt.sourceItemId, status: 'failed' });
            }
            return;
          }
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
          // Refresh der Dateiliste triggern, falls serverseitig Ordner-ID mitgeliefert wird
          if (evt.refreshFolderId && (evt.status === 'completed' || evt.message === 'stored_local')) {
            try { window.dispatchEvent(new CustomEvent('library_refresh', { detail: { folderId: evt.refreshFolderId } })); } catch {}
          }
          setItems(prev => {
            const idx = prev.findIndex(p => p.jobId === evt.jobId);
            const patch: Partial<JobListItem> = {
              status: evt.status,
              lastMessage: evt.message ?? prev[idx]?.lastMessage,
              lastProgress: evt.progress ?? prev[idx]?.lastProgress,
              updatedAt: evt.updatedAt,
              jobType: evt.jobType ?? prev[idx]?.jobType,
              fileName: evt.fileName ?? prev[idx]?.fileName,
            };
            if (idx >= 0) {
              const updated = { ...prev[idx], ...patch };
              const next = [...prev];
              next[idx] = updated;
              // bei Update nach oben reihen (neueste zuerst)
              next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
              return next;
            }
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
            const inserted: JobListItem = {
              jobId: evt.jobId,
              status: evt.status,
              updatedAt: evt.updatedAt,
              lastMessage: evt.message,
              lastProgress: evt.progress,
              jobType: evt.jobType,
              fileName: evt.fileName,
            };
            return [inserted, ...prev];
          });
        } catch {}
      };
      es.addEventListener('job_update', onUpdate as unknown as EventListener);
      es.addEventListener('error', () => {
        try { es.close(); } catch {}
        if (retryTimer) clearTimeout(retryTimer);
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
      setItems(prev => {
        const idx = prev.findIndex(p => p.jobId === detail.jobId);
        const patch: Partial<JobListItem> = {
          status: detail.status,
          lastMessage: detail.message ?? prev[idx]?.lastMessage,
          lastProgress: detail.progress ?? prev[idx]?.lastProgress,
          updatedAt: detail.updatedAt,
          jobType: detail.jobType ?? prev[idx]?.jobType,
          fileName: detail.fileName ?? prev[idx]?.fileName,
        };
        if (idx >= 0) {
          const updated = { ...prev[idx], ...patch };
          const next = [...prev];
          next[idx] = updated;
          next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
          return next;
        }
        const inserted: JobListItem = {
          jobId: detail.jobId,
          status: detail.status,
          updatedAt: detail.updatedAt,
          lastMessage: detail.message,
          lastProgress: detail.progress,
          jobType: detail.jobType,
          fileName: detail.fileName,
        };
        return [inserted, ...prev];
      });
    };
    window.addEventListener('job_update_local', onLocal as unknown as EventListener);
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventRef.current) try { eventRef.current.close(); } catch {}
      window.removeEventListener('job_update_local', onLocal as unknown as EventListener);
    };
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter, refreshNow]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/start`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const params = new URLSearchParams({ page: String(next), limit: '20' });
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (batchFilter) params.set('batchName', batchFilter);
    const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates, refreshNow]);

  function JobTypeIcon({ jobType }: { jobType?: string }) {
    const type = (jobType || '').toLowerCase();
    const Icon = type === 'pdf' ? FileText
      : type === 'audio' ? FileAudio
      : type === 'video' ? FileVideo
      : type === 'image' ? ImageIcon
      : type === 'text' ? FileType2
      : FileIcon;
    return <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />;
  }

  function hideJob(jobId: string) {
    setHiddenIds(prev => new Set(prev).add(jobId));
  }

  function hideAllJobs() {
    setHiddenIds(new Set(items.map(i => i.jobId)));
  }

  async function deleteJob(jobId: string) {
    try {
      const confirmed = window.confirm('Diesen Job endgültig löschen?');
      if (!confirmed) return;
      const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        alert(`Löschen fehlgeschlagen: ${msg}`);
        return;
      }
      setItems(prev => prev.filter(i => i.jobId !== jobId));
      setHiddenIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
      if (openTraces.has(jobId)) setOpenTraces(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    } catch {
      alert(`Löschen fehlgeschlagen`);
    }
  }

  return (
    <div className="pointer-events-none">
      {/* Handle */}
      <div className={cn(
        "fixed top-16 right-0 z-40 transition-transform",
        isOpen ? "translate-x-[calc(0px)]" : "translate-x-0"
      )}>
        <button
          onClick={handleToggle}
          className={cn(
            "pointer-events-auto select-none",
            "bg-primary text-primary-foreground",
            "rounded-l-md shadow",
            "px-2 py-1",
            "hover:opacity-90"
          )}
          aria-label={isOpen ? 'Panel schließen' : 'Job-Monitor öffnen'}
        >
          {isOpen ? '×' : '≡'}
        </button>
      </div>

      {/* Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-screen z-30",
        "w-[420px] md:w-[520px]",
        "bg-background border-l",
        "shadow-lg",
        "transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full",
        "pointer-events-auto"
      )}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <span>Secretary Jobs</span>
              <span className="text-xs text-muted-foreground">Q {serverCounts?.queued ?? queuedCount} • R {serverCounts?.running ?? runningCount} • C {serverCounts?.completed ?? completedCount} • F {serverCounts?.failed ?? failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
              </button>
              <button
                onClick={hideAllJobs}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label="Alle ausblenden"
                title="Alle ausblenden"
              >
                <Ban className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={handleToggle} aria-label="Schließen">×</Button>
          </div>
          <div className="px-4 py-1 border-b text-xs text-muted-foreground flex items-center gap-4">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Queued {serverCounts?.queued ?? queuedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />Running {serverCounts?.running ?? runningCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />Completed {serverCounts?.completed ?? completedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Failed {serverCounts?.failed ?? failedCount}</span>
            {/* Workersteuerung entfernt: Worker läuft automatisch */}
            <span className="ml-auto inline-flex items-center gap-2" title={workerStatus ? `Interval ${workerStatus.intervalMs}ms • Concurrency ${workerStatus.concurrency}` : ''}>
              <span className={cn("inline-block h-2 w-2 rounded-full", (workerStatus?.state === 'running') ? 'bg-emerald-500' : 'bg-gray-400')} />
              <span>{workerStatus?.state === 'running' ? 'Worker läuft' : 'Worker gestoppt'}</span>
              {typeof workerStatus?.stats?.processed === 'number' && (
                <span>• processed {workerStatus.stats.processed}</span>
              )}
              {typeof workerStatus?.stats?.errors === 'number' && workerStatus.stats.errors > 0 && (
                <span className="text-red-600">• errors {workerStatus.stats.errors}</span>
              )}
            </span>
          </div>
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle ({serverCounts?.total ?? (queuedCount + runningCount + completedCount + failedCount)})</option>
              <option value="queued">Queued ({serverCounts?.queued ?? queuedCount})</option>
              <option value="running">Running ({serverCounts?.running ?? runningCount})</option>
              <option value="completed">Completed ({serverCounts?.completed ?? completedCount})</option>
              <option value="failed">Failed ({serverCounts?.failed ?? failedCount})</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
            <Button size="sm" onClick={async () => {
              try {
                const payload: Record<string, string> = {};
                if (statusFilter && statusFilter !== 'all') payload.status = statusFilter;
                if (batchFilter) payload.batchName = batchFilter;
                const res = await fetch('/api/external/jobs/start-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) return;
                await refreshNow();
              } catch {}
            }}>Neu starten (gefiltert)</Button>
          </div>
          {/* Globale Trace-Anzeige entfernt; Traces erscheinen inline pro Job */}
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0" title={item.jobType || 'job'}>
                        <JobTypeIcon jobType={item.jobType} />
                      </div>
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="truncate text-sm font-medium cursor-default" title={item.fileName || item.jobId}>
                            {item.fileName ? truncateMiddle(item.fileName, 40) : (item.operation || 'job')}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" align="start" className="w-[36rem] p-0 max-h-[85vh]">
                          <ScrollArea className="h-[80vh] overflow-y-auto p-2 text-xs">
                            <JobLogs jobId={item.jobId} />
                          </ScrollArea>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 w-40 justify-end">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toggleTrace(item.jobId)}
                              className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                              aria-label={openTraces.has(item.jobId) ? "Trace ausblenden" : "Trace anzeigen"}
                              title={openTraces.has(item.jobId) ? "Trace ausblenden" : "Trace anzeigen"}
                            >
                              <Activity className={cn("h-4 w-4", openTraces.has(item.jobId) ? "text-primary" : "text-muted-foreground")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{openTraces.has(item.jobId) ? "Trace ausblenden" : "Trace anzeigen"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => deleteJob(item.jobId)}
                              className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                              aria-label="Job löschen"
                              title="Job löschen"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Job löschen</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/external/jobs/${encodeURIComponent(item.jobId)}/markdown`, { cache: 'no-store' });
                                  if (!res.ok) return;
                                  const text = await res.text();
                                  await navigator.clipboard.writeText(text);
                                } catch {}
                              }}
                              className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                              aria-label="Als Markdown kopieren"
                              title="Als Markdown kopieren"
                            >
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Als Markdown kopieren</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {item.status !== 'running' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
                    {item.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        {formatDuration(item.createdAt, item.updatedAt)}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <div className="truncate" title={item.lastMessage}>{item.lastMessage || '—'}</div>
                    <div>{formatRelative(item.updatedAt)}</div>
                  </div>
                  {openTraces.has(item.jobId) ? (
                    <div className="mt-3 border-t pt-3">
                      <div className="max-h-[50vh] overflow-auto">
                        <TraceViewer jobId={item.jobId} />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-sm text-muted-foreground py-6 text-center">Keine Jobs</li>
              )}
            </ul>
          </ScrollArea>
          <div className="p-3 border-t flex items-center justify-center">
            <Button size="sm" variant="outline" onClick={loadMore} disabled={!hasMore}>Ältere laden</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobLogs({ jobId }: { jobId: string }) {
  const [logs, setLogs] = useState<Array<{ timestamp: string; phase?: string; progress?: number; message?: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/external/jobs/${jobId}?limit=50`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const l: Array<{ timestamp?: string; phase?: string; progress?: number; message?: string }> = Array.isArray(json.logs) ? json.logs : [];
        setLogs(l.map((e) => ({
          timestamp: String(e.timestamp),
          phase: typeof e.phase === 'string' ? e.phase : undefined,
          progress: typeof e.progress === 'number' ? e.progress : undefined,
          message: typeof e.message === 'string' ? e.message : undefined,
        })));
        setLoaded(true);
      } catch {
        // ignore
      }
    }
    if (!loaded) load();
    return () => { active = false; };
  }, [jobId, loaded]);

  if (!loaded) return <div className="text-muted-foreground">Lade Logs…</div>;
  // Filter: keinerlei reine Worker-Details ohne message nicht anzeigen
  const visible = logs.filter(l => (l.message && l.message.trim() !== ''));
  if (visible.length === 0) return <div className="text-muted-foreground">Keine Logs</div>;

  return (
    <div className="space-y-2">
      {visible.map((l, idx) => (
        <div key={idx} className="flex items-start justify-between gap-2">
          <div className="truncate">
            <div className="font-medium truncate">{l.message || '—'} {typeof l.progress === 'number' ? `(${Math.round(l.progress)}%)` : ''}</div>
          </div>
          <div className="text-muted-foreground">{formatClock(l.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}


