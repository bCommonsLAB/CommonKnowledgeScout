"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { upsertJobStatusAtom, upsertJobInfoAtom, clearJobInfoAtom } from '@/atoms/job-status';
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom';
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { TraceViewer } from '@/components/shared/trace-viewer';
import {
  JobWorkerHealthBanner,
  JobWorkerInfoPopover,
  computeWorkerHealth,
  type JobMonitorServerCounters,
  type JobWorkerApiStatus,
} from '@/components/shared/job-monitor-worker-status';
import {
  JobMonitorRowActions,
  JobMonitorRowOpenButtons,
  type JobMonitorRowItem,
} from '@/components/shared/job-monitor-row-actions';
import { FileText, FileAudio, FileVideo, Image as ImageIcon, File as FileIcon, FileType2, RefreshCw, Ban } from "lucide-react";
import type { JobUpdateEvent } from '@/lib/events/job-event-bus';

interface JobListItem {
  jobId: string;
  status: string;
  operation?: string;
  worker?: string;
  jobType?: string;
  fileName?: string;
  sourceItemId?: string;
  sourceParentId?: string;
  shadowTwinFolderId?: string; // Shadow-Twin-Verzeichnis-ID (falls vorhanden)
  resultItemId?: string; // transformiertes Ergebnis (z.B. `${base}.${template}.${lang}.md`)
  libraryId?: string;
  updatedAt?: string;
  createdAt?: string;
  lastMessage?: string;
  lastProgress?: number;
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
  const sseRetryAttemptRef = useRef<number>(0);
  const isFetchingRef = useRef(false);
  // Ref fuer isOpen, damit SSE-Handler immer aktuellen Wert haben
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);
  const upsertJobInfo = useSetAtom(upsertJobInfoAtom);
  const clearJobInfo = useSetAtom(clearJobInfoAtom);
  const triggerShadowTwinAnalysis = useSetAtom(shadowTwinAnalysisTriggerAtom);
  const shadowTwinRefreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const setJobMonitorPanelOpen = useSetAtom(jobMonitorPanelOpenAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [serverCounts, setServerCounts] = useState<JobMonitorServerCounters | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);
  const [workerStatus, setWorkerStatus] = useState<JobWorkerApiStatus | null>(null);
  const [workerFetchError, setWorkerFetchError] = useState<string | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [healthClock, setHealthClock] = useState(0);
  const [openTraces, setOpenTraces] = useState<Set<string>>(new Set());
  const toggleTrace = (jobId: string) => {
    setOpenTraces(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const navigateToFolder = useFolderNavigation();

  // Prüfe ob wir im Gallery-Modus sind (sollte ausgeblendet werden)
  // Job Handle soll NICHT angezeigt werden im Gallery-Modus, aber auf anderen Seiten wie Integration Tests
  const isGalleryMode = pathname === '/library/gallery' || pathname?.startsWith('/explore/');
  
  // Prüfe ob wir auf der Integration Tests Seite sind (sollte Job Handle anzeigen)
  const isIntegrationTestsPage = pathname === '/integration-tests';

  const scheduleShadowTwinReanalysisBurst = useCallback(() => {
    // Storage-Backends (v.a. WebDAV/Nextcloud) können Artefakte kurz verzögert sichtbar machen.
    // Deshalb triggern wir die Analyse mehrmals mit wachsendem Abstand.
    const delaysMs = [400, 1500, 4000];
    delaysMs.forEach((delayMs) => {
      const timer = setTimeout(() => triggerShadowTwinAnalysis((v) => v + 1), delayMs);
      shadowTwinRefreshTimersRef.current.push(timer);
    });
  }, [triggerShadowTwinAnalysis]);

  /**
   * REST-Jobliste mit dem globalen Job-Info-Atom abgleichen.
   * Hintergrund: SSE (/stream) ist nur bei geoeffnetem Panel aktiv. Schliesst der Nutzer
   * das Panel waehrend der Pipeline, kommt kein finales `job_update` (completed/failed) an —
   * die Vorschau bleibt dann z.B. auf 90 % / "Story wird verarbeitet", obwohl der Server
   * den Job schon als abgeschlossen listet. Terminal-Eintraege aus der Liste entfernen
   * den veralteten Fortschritt im Atom (analog zum clear nach SSE-completed).
   */
  const syncTerminalJobAtomsFromList = useCallback(
    (rows: JobListItem[]) => {
      for (const row of rows) {
        const sid = row.sourceItemId;
        if (!sid) continue;
        const st = String(row.status || '').toLowerCase();
        if (st === 'completed' || st === 'failed') {
          clearJobInfo(sid);
        }
      }
    },
    [clearJobInfo]
  );

  useEffect(() => {
    return () => {
      shadowTwinRefreshTimersRef.current.forEach((timer) => clearTimeout(timer));
      shadowTwinRefreshTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    setJobMonitorPanelOpen(isOpen);
  }, [isOpen, setJobMonitorPanelOpen]);

  useEffect(() => {
    return () => {
      setJobMonitorPanelOpen(false);
    };
  }, [setJobMonitorPanelOpen]);

  /**
   * Lädt fehlende Felder eines Jobs (z. B. `libraryId`, `shadowTwinFolderId`) nach.
   * Hintergrund: Die Listen-API liefert teils nur eine Untermenge zurück, die UI
   * verfügt aber nicht immer über die volle Korrelation.
   */
  const fetchJobDetail = useCallback(async (jobId: string): Promise<Partial<JobListItem> | null> => {
    try {
      const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      const detail: Partial<JobListItem> = {
        libraryId: typeof json?.libraryId === 'string' ? json.libraryId : undefined,
        sourceItemId: typeof json?.correlation?.source?.itemId === 'string' ? json.correlation.source.itemId : undefined,
        sourceParentId: typeof json?.correlation?.source?.parentId === 'string' ? json.correlation.source.parentId : undefined,
        shadowTwinFolderId: typeof json?.shadowTwinState?.shadowTwinFolderId === 'string'
          ? json.shadowTwinState.shadowTwinFolderId
          : undefined,
        resultItemId: typeof json?.result?.savedItemId === 'string' ? json.result.savedItemId : undefined,
      };
      return detail;
    } catch (err) {
      console.warn('[JobMonitorPanel] Konnte Job-Detail nicht laden:', err);
      return null;
    }
  }, []);

  /**
   * Navigiert zur Quell-Datei eines Jobs und wählt sie im Library-Browser aus.
   * Wirft bei fehlenden Pflichtfeldern (sourceItemId, libraryId, sourceParentId).
   */
  const openJobFile = useCallback(async (rowItem: JobMonitorRowItem) => {
    const list = items.find((it) => it.jobId === rowItem.jobId);
    const base: JobListItem = list ?? {
      jobId: rowItem.jobId,
      status: rowItem.status,
      fileName: rowItem.fileName,
      sourceItemId: rowItem.sourceItemId,
      shadowTwinFolderId: rowItem.shadowTwinFolderId,
      resultItemId: rowItem.resultItemId,
      libraryId: rowItem.libraryId,
    };
    if (!base.sourceItemId) {
      throw new Error('Keine Quell-Datei-ID verfügbar.');
    }
    let libraryId = base.libraryId;
    let targetFolderId = base.sourceParentId;
    if (!libraryId || !targetFolderId) {
      const detail = await fetchJobDetail(base.jobId);
      libraryId = libraryId || detail?.libraryId;
      targetFolderId = targetFolderId || detail?.sourceParentId;
    }
    if (!libraryId) {
      throw new Error('Keine Bibliothek-ID für diesen Job gefunden.');
    }
    if (!targetFolderId) {
      throw new Error('Kein Ziel-Ordner für diesen Job gefunden.');
    }

    const params = new URLSearchParams(searchParams ?? undefined);
    params.set('folderId', targetFolderId);
    const onLibraryPath = pathname?.startsWith('/library') === true;
    const url = onLibraryPath
      ? `${pathname}?${params.toString()}`
      : `/library?${new URLSearchParams({ libraryId, folderId: targetFolderId }).toString()}`;
    router.replace(url);

    await navigateToFolder(targetFolderId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    window.dispatchEvent(new CustomEvent('library_refresh', {
      detail: {
        folderId: targetFolderId,
        selectFileId: base.sourceItemId,
      },
    }));
  }, [fetchJobDetail, items, navigateToFolder, pathname, router, searchParams]);

  /**
   * Navigiert zum Ergebnis eines Jobs im Shadow-Twin-Ordner. Wenn die Folder-ID nicht
   * in der Listen-Antwort enthalten ist (z. B. Mongo-only Shadow-Twin), wird das Detail
   * nachgeladen — sonst war der Button früher gar nicht sichtbar.
   */
  const openJobResultFile = useCallback(async (rowItem: JobMonitorRowItem) => {
    const list = items.find((it) => it.jobId === rowItem.jobId);
    let shadowTwinFolderId = list?.shadowTwinFolderId ?? rowItem.shadowTwinFolderId;
    const resultItemId = list?.resultItemId ?? rowItem.resultItemId;
    if (!resultItemId) {
      throw new Error('Kein Ergebnis-Artefakt für diesen Job gefunden.');
    }
    if (!shadowTwinFolderId) {
      const detail = await fetchJobDetail(rowItem.jobId);
      shadowTwinFolderId = detail?.shadowTwinFolderId;
    }
    if (!shadowTwinFolderId) {
      throw new Error('Shadow-Twin-Ordner für diesen Job nicht ermittelbar.');
    }

    const params = new URLSearchParams(searchParams ?? undefined);
    params.set('folderId', shadowTwinFolderId);
    const onLibraryPath = pathname?.startsWith('/library') === true;
    const url = onLibraryPath
      ? `${pathname}?${params.toString()}`
      : `/library?${new URLSearchParams({ folderId: shadowTwinFolderId }).toString()}`;
    router.replace(url);

    await navigateToFolder(shadowTwinFolderId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    window.dispatchEvent(new CustomEvent('library_refresh', {
      detail: {
        folderId: shadowTwinFolderId,
        selectFileId: resultItemId,
        shadowTwinFolderId,
        triggerShadowTwinAnalysis: true,
      },
    }));
  }, [fetchJobDetail, items, navigateToFolder, pathname, router, searchParams]);

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
        // Filter nach aktiver Library, wenn verfügbar
        if (activeLibraryId) {
          params.set('libraryId', activeLibraryId);
        }
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        // Debug: Prüfe ob libraryId in den Items vorhanden ist
        if (json.items && json.items.length > 0) {
          console.log('[JobMonitorPanel] Jobs geladen', { 
            count: json.items.length, 
            hasLibraryId: json.items.some((item: JobListItem) => item.libraryId),
            sampleItem: json.items[0]
          });
        }
        const rows: JobListItem[] = json.items || [];
        setItems(prev => (replace ? rows : [...prev, ...rows]));
        syncTerminalJobAtomsFromList(rows);
        setHasMore(rows.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter, activeLibraryId, syncTerminalJobAtomsFromList]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const params = new URLSearchParams();
        // Filter nach aktiver Library, wenn verfügbar
        if (activeLibraryId) {
          params.set('libraryId', activeLibraryId);
        }
        const url = `/api/external/jobs/batches${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch (err) {
        console.error('[JobMonitorPanel] Batch-Namen laden fehlgeschlagen:', err);
      }
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen, activeLibraryId]);

  // Serverseitige Zähler laden (gesamt, optional gefiltert nach Batch)
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    let active = true;
    async function loadCounts() {
      try {
        const params = new URLSearchParams();
        if (batchFilter) params.set('batchName', batchFilter);
        // Filter nach aktiver Library, wenn verfügbar
        if (activeLibraryId) {
          params.set('libraryId', activeLibraryId);
        }
        const res = await fetch(`/api/external/jobs/counters?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        setServerCounts(json.counters || null);
      } catch (err) {
        console.error('[JobMonitorPanel] Zähler laden fehlgeschlagen:', err);
      }
    }
    void loadCounts();
    const t = setInterval(loadCounts, 5000);
    return () => { active = false; clearInterval(t); };
  }, [isOpen, batchFilter, liveUpdates, activeLibraryId]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => { setHealthClock((c) => c + 1); }, 10_000);
    return () => { clearInterval(t); };
  }, [isOpen]);

  const refreshDiagnostics = useCallback(async () => {
    setDiagnosticsBusy(true);
    try {
      try {
        const w = await fetch('/api/external/jobs/worker', { cache: 'no-store' });
        if (w.ok) {
          setWorkerFetchError(null);
          setWorkerStatus((await w.json()) as JobWorkerApiStatus);
        } else {
          setWorkerFetchError(`${w.status} ${w.statusText}`);
          setWorkerStatus(null);
        }
      } catch (e) {
        setWorkerFetchError(e instanceof Error ? e.message : String(e));
        setWorkerStatus(null);
      }
      try {
        const params = new URLSearchParams();
        if (batchFilter) params.set('batchName', batchFilter);
        if (activeLibraryId) {
          params.set('libraryId', activeLibraryId);
        }
        const c = await fetch(`/api/external/jobs/counters?${params.toString()}`, { cache: 'no-store' });
        if (c.ok) {
          const json = await c.json();
          setServerCounts(json.counters ?? null);
        }
      } catch {
        /* Zähler optional */
      }
    } finally {
      setDiagnosticsBusy(false);
    }
  }, [batchFilter, activeLibraryId]);

  const workerHealthIssue = useMemo(
    () => {
      void healthClock;
      return computeWorkerHealth({
        workerStatus,
        workerFetchError,
        counters: serverCounts,
        nowMs: Date.now(),
      });
    },
    [workerStatus, workerFetchError, serverCounts, healthClock],
  );

  // Worker-Status laden
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    let active = true;
    async function loadWorker() {
      try {
        const res = await fetch('/api/external/jobs/worker', { cache: 'no-store' });
        if (!res.ok) {
          if (!active) return;
          setWorkerFetchError(`${res.status} ${res.statusText}`);
          setWorkerStatus(null);
          return;
        }
        const json = (await res.json()) as JobWorkerApiStatus;
        if (!active) return;
        setWorkerFetchError(null);
        setWorkerStatus(json);
      } catch (err) {
        if (!active) return;
        setWorkerFetchError(err instanceof Error ? err.message : String(err));
        setWorkerStatus(null);
        console.error('[JobMonitorPanel] Worker-Status laden fehlgeschlagen:', err);
      }
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
      // Filter nach aktiver Library, wenn verfügbar
      if (activeLibraryId) {
        params.set('libraryId', activeLibraryId);
      }
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const list = json.items || [];
      setItems(list);
      syncTerminalJobAtomsFromList(list);
      setPage(1);
      setHasMore(list.length === 20);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, statusFilter, batchFilter, activeLibraryId, syncTerminalJobAtomsFromList]);

  // SSE läuft immer, solange Live-Updates aktiv sind – unabhängig ob das Panel geöffnet ist.
  // So bleiben Fortschrittsbalken und Atom-Updates (jobInfoByItemIdAtom) stets aktuell,
  // auch wenn der Benutzer das Monitor-Panel nie öffnet.
  // Panel-interne Items-Listen-Updates sind weiterhin mit isOpenRef.current geschützt (Zeile 494).
  useEffect(() => {
    if (!liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch (err) { console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err); } eventRef.current = null; }
      sseRetryAttemptRef.current = 0;
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch (err) { console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err); }
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen
      es.onopen = () => {
        // Verbindung steht wieder → Backoff zurücksetzen
        sseRetryAttemptRef.current = 0;
        lastEventTsRef.current = Date.now();
      };

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          // Terminal: failed sofort anwenden und weitere Progress-Events für diesen Job ignorieren (durch Statusüberschreibung)
          if (evt.status === 'failed' || evt.phase === 'failed') {
            // UI-Liste nur aktualisieren wenn Panel geoeffnet
            if (isOpenRef.current) {
              setItems(prev => {
                const idx = prev.findIndex(p => p.jobId === evt.jobId);
                if (idx < 0) return prev;
                const updated = { ...prev[idx], status: 'failed', lastMessage: evt.message ?? prev[idx].lastMessage, updatedAt: evt.updatedAt };
                const next = [...prev];
                next[idx] = updated;
                next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
                return next;
              });
            }
            // Atom-Updates passieren IMMER (fuer globales Job-Status-Tracking)
            if (evt.sourceItemId && evt.status) {
              upsertJobStatus({ itemId: evt.sourceItemId, status: 'failed' });
              upsertJobInfo({ 
                itemId: evt.sourceItemId, 
                status: 'failed',
                progress: evt.progress,
                message: evt.message,
                jobId: evt.jobId,
                updatedAt: evt.updatedAt,
                phase: evt.phase,
              });
              // Failed-Jobs nach 5s aus dem Atom entfernen (analog zu completed)
              setTimeout(() => clearJobInfo(evt.sourceItemId!), 5000);
            }
            return;
          }
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
            upsertJobInfo({ 
              itemId: evt.sourceItemId, 
              status: evt.status as 'queued' | 'running' | 'completed' | 'failed',
              progress: evt.progress,
              message: evt.message,
              jobId: evt.jobId,
              updatedAt: evt.updatedAt,
              phase: evt.phase,
            });
            // Bei completed: Shadow-Twin-Analyse triggern und Job-Info nach kurzer Zeit entfernen
            if (evt.status === 'completed') {
              scheduleShadowTwinReanalysisBurst();
              if (evt.sourceItemId) {
                setTimeout(() => clearJobInfo(evt.sourceItemId!), 5000);
              }
            }
          }
          // Refresh der Dateiliste triggern, sobald Artefakte geschrieben wurden
          // (Filesystem: stored_local, Mongo: stored_mongo) oder wenn der Job abgeschlossen ist.
          // WICHTIG: Refresh sowohl Parent als auch Shadow-Twin-Verzeichnis (falls vorhanden)
          const shouldRefreshFolders =
            evt.status === 'completed' ||
            evt.message === 'stored_local' ||
            evt.message === 'stored_mongo'
          if (shouldRefreshFolders) {
            try {
              // Refresh alle betroffenen Ordner (Parent + Shadow-Twin)
              const refreshFolderIds = (Array.isArray(evt.refreshFolderIds) && evt.refreshFolderIds.length > 0)
                ? evt.refreshFolderIds
                : (evt.refreshFolderId ? [evt.refreshFolderId] : [])

              refreshFolderIds.forEach(folderId => {
                if (!folderId) return
                window.dispatchEvent(new CustomEvent('library_refresh', {
                  detail: {
                    folderId,
                    shadowTwinFolderId: evt.shadowTwinFolderId || null,
                    triggerShadowTwinAnalysis: true // Flag für Shadow-Twin-Analyse-Neuberechnung
                  }
                }))
              })
            } catch (err) {
              console.warn('[JobMonitorPanel] library_refresh-Event fehlgeschlagen:', err);
            }
          }
          // UI-Liste nur aktualisieren wenn Panel geoeffnet
          if (isOpenRef.current) {
            setItems(prev => {
              const idx = prev.findIndex(p => p.jobId === evt.jobId);
              const patch: Partial<JobListItem> = {
                status: evt.status,
                lastMessage: evt.message ?? prev[idx]?.lastMessage,
                lastProgress: evt.progress ?? prev[idx]?.lastProgress,
                updatedAt: evt.updatedAt,
                jobType: evt.jobType ?? prev[idx]?.jobType,
                fileName: evt.fileName ?? prev[idx]?.fileName,
                sourceItemId: evt.sourceItemId ?? prev[idx]?.sourceItemId,
                libraryId: evt.libraryId ?? prev[idx]?.libraryId,
                resultItemId: evt.result?.savedItemId ?? prev[idx]?.resultItemId,
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
                sourceItemId: evt.sourceItemId,
                libraryId: evt.libraryId,
                resultItemId: evt.result?.savedItemId,
              };
              return [inserted, ...prev];
            });
          }
        } catch (err) {
          console.warn('[JobMonitorPanel] job_update-Event verarbeiten fehlgeschlagen:', err);
        }
      };
      es.addEventListener('job_update', onUpdate as unknown as EventListener);
      // "connected" und "ping" sind Server-Sent Events aus der Stream-Route.
      // Ohne Listener würden wir fälschlicherweise "idle" annehmen und pollen.
      es.addEventListener('connected', () => { lastEventTsRef.current = Date.now(); });
      es.addEventListener('ping', () => { lastEventTsRef.current = Date.now(); });
      es.addEventListener('error', () => {
        try { es.close(); } catch (err) { console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err); }
        if (retryTimer) clearTimeout(retryTimer);
        // Reconnect mit Backoff, um Dev-Logs nicht zu fluten, wenn SSE instabil ist.
        // 0 → 1s, 1 → 2s, 2 → 4s ... bis max 30s.
        sseRetryAttemptRef.current = Math.min(sseRetryAttemptRef.current + 1, 6);
        const delayMs = Math.min(1000 * (2 ** (sseRetryAttemptRef.current - 1)), 30_000);
        retryTimer = setTimeout(() => { if (liveUpdates) connect(); }, delayMs);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
      // Atom-Updates passieren IMMER (fuer globales Job-Status-Tracking)
      if (detail.sourceItemId && detail.status) {
        upsertJobStatus({ itemId: detail.sourceItemId, status: detail.status });
        upsertJobInfo({ 
          itemId: detail.sourceItemId, 
          status: detail.status as 'queued' | 'running' | 'completed' | 'failed',
          progress: detail.progress,
          message: detail.message,
          jobId: detail.jobId,
          updatedAt: detail.updatedAt,
          phase: detail.phase,
        });
        if (detail.status === 'completed') {
          scheduleShadowTwinReanalysisBurst();
          if (detail.sourceItemId) {
            setTimeout(() => clearJobInfo(detail.sourceItemId!), 5000);
          }
        }
      }
      // UI-Liste nur aktualisieren wenn Panel geoeffnet
      if (isOpenRef.current) {
        setItems(prev => {
          const idx = prev.findIndex(p => p.jobId === detail.jobId);
          const patch: Partial<JobListItem> = {
            status: detail.status,
            lastMessage: detail.message ?? prev[idx]?.lastMessage,
            lastProgress: detail.progress ?? prev[idx]?.lastProgress,
            updatedAt: detail.updatedAt,
            jobType: detail.jobType ?? prev[idx]?.jobType,
            fileName: detail.fileName ?? prev[idx]?.fileName,
            sourceItemId: detail.sourceItemId ?? prev[idx]?.sourceItemId,
            libraryId: detail.libraryId ?? prev[idx]?.libraryId,
            resultItemId: detail.result?.savedItemId ?? prev[idx]?.resultItemId,
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
            sourceItemId: detail.sourceItemId,
            libraryId: detail.libraryId,
            resultItemId: detail.result?.savedItemId,
          };
          return [inserted, ...prev];
        });
      }
    };
    window.addEventListener('job_update_local', onLocal as unknown as EventListener);
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventRef.current) try { eventRef.current.close(); } catch (err) { console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err); }
      window.removeEventListener('job_update_local', onLocal as unknown as EventListener);
    };
  // isOpen bewusst nicht in deps: SSE soll unabhängig vom Panel-Zustand laufen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveUpdates, upsertJobStatus, upsertJobInfo, clearJobInfo, triggerShadowTwinAnalysis, scheduleShadowTwinReanalysisBurst]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  /**
   * Wirft bei Fehlern (HTTP, Netzwerk). Erfolgsmeldung kommt aus
   * `JobMonitorRowActions` via Sonner-Toast.
   */
  const retryJob = useCallback(async (jobId: string): Promise<void> => {
    const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}/start`, { method: 'POST' });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `${res.status} ${res.statusText}${detail ? ` – ${detail.slice(0, 200)}` : ''}`,
      );
    }
    await refreshNow();
  }, [refreshNow]);
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const params = new URLSearchParams({ page: String(next), limit: '20' });
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (batchFilter) params.set('batchName', batchFilter);
    // Filter nach aktiver Library, wenn verfügbar
    if (activeLibraryId) {
      params.set('libraryId', activeLibraryId);
    }
    const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    const newRows: JobListItem[] = json.items || [];
    setItems(prev => [...prev, ...newRows]);
    setPage(next);
    setHasMore(newRows.length === 20);
    syncTerminalJobAtomsFromList(newRows);
  };

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      // Achtung: Bei "stillen" SSE-Verbindungen (keine job_update Events) dürfen wir nicht aggressiv pollen.
      // Wir werten "ping"/"connected" als Aktivität (siehe SSE-Listener) und wählen ein konservatives Timeout.
      if (idleMs > 30_000) {
        // Timestamp sofort aktualisieren, sonst würde der 2s-Timer dauerhaft feuern.
        lastEventTsRef.current = Date.now();
        void refreshNow();
      }
    };
    const timer = setInterval(onTick, 5000);
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

  function hideAllJobs() {
    setHiddenIds(new Set(items.map(i => i.jobId)));
  }

  /**
   * Wirft bei Fehlern (HTTP, Netzwerk). Die Inline-Bestätigung übernimmt
   * `JobMonitorRowActions`; ein echtes `window.confirm` ist deshalb nicht mehr nötig.
   */
  const deleteJob = useCallback(async (jobId: string): Promise<void> => {
    const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status} ${res.statusText}${msg ? ` – ${msg.slice(0, 200)}` : ''}`);
    }
    setItems(prev => prev.filter(i => i.jobId !== jobId));
    setHiddenIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    setOpenTraces(prev => {
      if (!prev.has(jobId)) return prev;
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    await refreshNow();
  }, [refreshNow]);

  /**
   * Lädt das Markdown-Trace eines Jobs und schreibt es in die Zwischenablage.
   * Fällt bei nicht-sicherem Origin (z. B. Electron `http://localhost`) auf
   * `document.execCommand('copy')` zurück, damit der Button nicht stumm versagt.
   */
  const copyJobMarkdown = useCallback(async (jobId: string): Promise<void> => {
    const res = await fetch(`/api/external/jobs/${encodeURIComponent(jobId)}/markdown`, { cache: 'no-store' });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status} ${res.statusText}${detail ? ` – ${detail.slice(0, 200)}` : ''}`);
    }
    const text = await res.text();
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clip && typeof clip.writeText === 'function') {
      try {
        await clip.writeText(text);
        return;
      } catch (err) {
        console.warn('[JobMonitorPanel] navigator.clipboard.writeText fehlgeschlagen, versuche Fallback:', err);
      }
    }
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      try {
        textarea.select();
        const ok = document.execCommand('copy');
        if (!ok) throw new Error('execCommand("copy") schlug fehl');
      } finally {
        document.body.removeChild(textarea);
      }
      return;
    }
    throw new Error('Zwischenablage nicht verfügbar.');
  }, []);

  return (
    <div className="pointer-events-none">
      {/* Handle - im Archiv-Modus (library) und Integration Tests anzeigen, nicht im Gallery-Modus */}
      {(!isGalleryMode || isIntegrationTestsPage) && (
        <div className={cn(
          "fixed right-0 z-40 transition-all duration-300 ease-in-out",
          isOpen ? "top-3" : "top-16",
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
      )}

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
              <JobWorkerInfoPopover
                workerStatus={workerStatus}
                workerFetchError={workerFetchError}
                serverCounts={serverCounts}
                healthIssue={workerHealthIssue}
                onRefresh={refreshDiagnostics}
                isRefreshing={diagnosticsBusy}
              />
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
          <JobWorkerHealthBanner issue={workerHealthIssue} />
          <div className="px-4 py-1 border-b text-xs text-muted-foreground flex items-center gap-4">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Queued {serverCounts?.queued ?? queuedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />Running {serverCounts?.running ?? runningCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />Completed {serverCounts?.completed ?? completedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Failed {serverCounts?.failed ?? failedCount}</span>
            {/* Workersteuerung entfernt: Worker läuft automatisch */}
            <span
              className="ml-auto inline-flex items-center gap-2"
              title={
                workerStatus
                  ? [
                      `Pool ${workerStatus.jobsWorkerPoolId ?? '?'}`,
                      workerStatus.workerId ? `Worker ${workerStatus.workerId}` : null,
                      `Interval ${workerStatus.intervalMs}ms`,
                      `Concurrency ${workerStatus.concurrency}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')
                  : ''
              }
            >
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
              } catch (err) {
                console.error('[JobMonitorPanel] Batch-Start fehlgeschlagen:', err);
              }
            }}>Neu starten (gefiltert)</Button>
          </div>
          {/* Globale Trace-Anzeige entfernt; Traces erscheinen inline pro Job */}
          <ScrollArea
            className="flex-1 min-h-0 min-w-0"
            viewportClassName="[&>div]:!block [&>div]:!min-w-0 [&>div]:w-full"
          >
            <ul className="p-3 space-y-2 min-w-0 w-full">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-2 min-w-0 w-full overflow-hidden",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="shrink-0" title={item.jobType || 'job'}>
                        <JobTypeIcon jobType={item.jobType} />
                      </div>
                      {/* Dateiname mit HoverCard für Logs */}
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div 
                            className="min-w-0 truncate text-xs font-medium cursor-default flex-1"
                            title={item.fileName || item.jobId}
                          >
                            {item.fileName ? truncateMiddle(item.fileName, 30) : (item.operation || 'job')}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" align="start" className="w-[36rem] p-0 max-h-[85vh]">
                          <ScrollArea className="h-[80vh] overflow-y-auto p-2 text-xs">
                            <JobLogs jobId={item.jobId} />
                          </ScrollArea>
                        </HoverCardContent>
                      </HoverCard>
                      <JobMonitorRowOpenButtons
                        item={item}
                        onOpenFile={openJobFile}
                        onOpenResult={openJobResultFile}
                      />
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <JobMonitorRowActions
                        item={item}
                        isTraceOpen={openTraces.has(item.jobId)}
                        onToggleTrace={toggleTrace}
                        onRetry={retryJob}
                        onDelete={deleteJob}
                        onCopyMarkdown={copyJobMarkdown}
                      />
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-1.5 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} className="h-1" />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
                    {item.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                        {formatDuration(item.createdAt, item.updatedAt)}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground flex items-center justify-between gap-2 min-w-0">
                    <div
                      className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]"
                      title={item.lastMessage}
                    >
                      {item.lastMessage || '—'}
                    </div>
                    <div className="shrink-0">{formatRelative(item.updatedAt)}</div>
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
  // Fehlermeldung aus job.error (wird bei failed-Jobs vom Server zurückgegeben)
  const [jobError, setJobError] = useState<{ code: string; message: string; details?: Record<string, unknown> } | null>(null);
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
        // Fehlermeldung aus job.error auslesen (vorhanden wenn Job failed)
        if (json.error && typeof json.error === 'object') {
          setJobError({
            code: typeof json.error.code === 'string' ? json.error.code : 'unknown',
            message: typeof json.error.message === 'string' ? json.error.message : String(json.error),
            details: json.error.details,
          });
        }
        setLoaded(true);
      } catch (err) {
        console.error('[JobMonitorPanel] Logs laden fehlgeschlagen:', err);
        setLoaded(true);
      }
    }
    if (!loaded) load();
    return () => { active = false; };
  }, [jobId, loaded]);

  if (!loaded) return <div className="text-muted-foreground">Lade Logs…</div>;
  // Filter: reine Worker-Details ohne message nicht anzeigen
  const visible = logs.filter(l => (l.message && l.message.trim() !== ''));

  return (
    <div className="space-y-2">
      {/* Fehlermeldung prominent oben anzeigen, wenn job.error vorhanden */}
      {jobError && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          <div className="font-semibold mb-0.5">Fehler [{jobError.code}]</div>
          <div className="break-all">{jobError.message}</div>
          {jobError.details && Object.keys(jobError.details).length > 0 && (
            <details className="mt-1 cursor-pointer">
              <summary className="text-[10px] text-red-600 hover:underline">Details anzeigen</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(jobError.details, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      {visible.length === 0 && !jobError && <div className="text-muted-foreground">Keine Logs</div>}
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


