"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { upsertJobStatusAtom, upsertJobInfoAtom, clearJobInfoAtom } from '@/atoms/job-status';
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TraceViewer } from '@/components/shared/trace-viewer';
import { FileText, FileAudio, FileVideo, Image as ImageIcon, File as FileIcon, FileType2, RefreshCw, Ban, Activity, Copy, Trash2, FolderOpen } from "lucide-react";
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
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);

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

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const navigateToFolder = useFolderNavigation();

  // Prüfe ob wir im Gallery-Modus sind (sollte ausgeblendet werden)
  // Job Handle soll NICHT angezeigt werden im Gallery-Modus, aber auf anderen Seiten wie Integration Tests
  const isGalleryMode = pathname === '/library/gallery' || pathname?.startsWith('/explore/');
  
  // Prüfe ob wir auf der Integration Tests Seite sind (sollte Job Handle anzeigen)
  const isIntegrationTestsPage = pathname === '/integration-tests';

  /**
   * Öffnet die Datei eines fehlerhaften Jobs im Datei-Viewer.
   * Navigiert zum Parent-Ordner und wählt die Datei dort aus.
   * Aktualisiert die URL mit folderId Parameter.
   */
  const openJobFile = async (item: JobListItem) => {
    console.log('[JobMonitorPanel] openJobFile aufgerufen', { 
      jobId: item.jobId, 
      sourceItemId: item.sourceItemId,
      libraryId: item.libraryId,
      sourceParentId: item.sourceParentId,
      fileName: item.fileName
    });

    if (!item.sourceItemId) {
      console.warn('[JobMonitorPanel] Keine sourceItemId verfügbar für Job', item.jobId);
      return;
    }

    // Wenn libraryId nicht verfügbar ist, versuche sie über die Job-Liste-API zu laden
    let libraryId = item.libraryId;
    if (!libraryId && item.sourceItemId) {
      try {
        // Versuche die libraryId über die Job-Liste zu finden (mit sourceItemId Filter)
        // Da wir die libraryId nicht kennen, müssen wir alle Bibliotheken durchsuchen
        // Oder: Lade einfach den Job nochmal über die Liste-API mit dem jobId Filter
        const listRes = await fetch(`/api/external/jobs?page=1&limit=1&status=failed`, { cache: 'no-store' });
        if (listRes.ok) {
          const listData = await listRes.json();
          const foundJob = listData.items?.find((j: JobListItem) => j.jobId === item.jobId);
          if (foundJob?.libraryId) {
            libraryId = foundJob.libraryId;
            console.log('[JobMonitorPanel] libraryId aus Job-Liste geladen', { libraryId, jobId: item.jobId });
          }
        }
      } catch (err) {
        console.warn('[JobMonitorPanel] Fehler beim Laden der libraryId', err);
      }
    }

    if (!libraryId) {
      console.error('[JobMonitorPanel] Keine libraryId verfügbar für Job', { 
        jobId: item.jobId,
        sourceItemId: item.sourceItemId,
        item: item
      });
      alert('Fehler: Keine Bibliothek-ID für diesen Job gefunden. Bitte laden Sie die Seite neu.');
      return;
    }

    // Bestimme das Ziel-Verzeichnis:
    // Verwende sourceParentId (Parent-Verzeichnis der Quelldatei aus correlation.source.parentId)
    // Dort liegt die ursprüngliche Datei, die wir öffnen wollen
    const targetFolderId = item.sourceParentId;
    
    console.log('[JobMonitorPanel] Öffne Job-Datei', {
      jobId: item.jobId,
      fileName: item.fileName,
      sourceItemId: item.sourceItemId,
      sourceParentId: item.sourceParentId, // Kommt aus correlation.source.parentId
      shadowTwinFolderId: item.shadowTwinFolderId,
      targetFolderId,
      libraryId: item.libraryId
    });
    
    // Navigiere zum Ziel-Ordner und wähle die Datei dort aus.
    // Das funktioniert auch, wenn die Datei verschoben wurde, da die Library-Komponente
    // den Ordner öffnet und die Datei automatisch auswählt.
    if (targetFolderId && item.sourceItemId) {
      try {
        // 1. Aktualisiere die URL mit folderId Parameter
        const params = new URLSearchParams(searchParams ?? undefined);
        params.set('folderId', targetFolderId);
        const url = `${pathname}?${params.toString()}`;
        console.log('[JobMonitorPanel] Aktualisiere URL', { url, folderId: targetFolderId });
        router.replace(url);
        
        // 2. Navigiere zum Ordner (aktualisiert den State und lädt den Ordner)
        console.log('[JobMonitorPanel] Navigiere zum Ordner...', { folderId: targetFolderId });
        await navigateToFolder(targetFolderId);
        
        // 3. Warte kurz, damit der Ordner initialisiert wird
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 4. Dispatch library_refresh Event mit selectFileId
        // Die Library-Komponente wird die Datei automatisch auswählen
        console.log('[JobMonitorPanel] Dispatch library_refresh Event', {
          folderId: targetFolderId,
          selectFileId: item.sourceItemId
        });
        window.dispatchEvent(new CustomEvent('library_refresh', {
          detail: {
            folderId: targetFolderId,
            selectFileId: item.sourceItemId
          }
        }));
        
        console.log('[JobMonitorPanel] Navigation abgeschlossen');
      } catch (error) {
        console.error('[JobMonitorPanel] Fehler beim Öffnen der Datei', {
          error: error instanceof Error ? error.message : String(error),
          jobId: item.jobId,
          targetFolderId,
          sourceItemId: item.sourceItemId
        });
        alert(`Fehler beim Öffnen der Datei: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.warn('[JobMonitorPanel] Keine folderId oder sourceItemId verfügbar', {
        jobId: item.jobId,
        shadowTwinFolderId: item.shadowTwinFolderId,
        sourceParentId: item.sourceParentId,
        sourceItemId: item.sourceItemId
      });
      alert('Fehler: Keine Ordner- oder Datei-ID verfügbar für diesen Job.');
    }
  };

  /**
   * Öffnet das erzeugte Ergebnis (transformiertes Markdown) im Shadow‑Twin Ordner.
   * WICHTIG: Wir navigieren bewusst nur auf User-Klick (kein Auto-Navigation bei "completed").
   */
  const openJobResultFile = async (item: JobListItem) => {
    if (!item.shadowTwinFolderId || !item.resultItemId) {
      alert('Ergebnis kann nicht geöffnet werden: missing shadowTwinFolderId/resultItemId.');
      return;
    }

    try {
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set('folderId', item.shadowTwinFolderId);
      const url = `${pathname}?${params.toString()}`;
      router.replace(url);

      await navigateToFolder(item.shadowTwinFolderId);
      await new Promise(resolve => setTimeout(resolve, 300));

      window.dispatchEvent(new CustomEvent('library_refresh', {
        detail: {
          folderId: item.shadowTwinFolderId,
          selectFileId: item.resultItemId,
          shadowTwinFolderId: item.shadowTwinFolderId,
          triggerShadowTwinAnalysis: true,
        }
      }));
    } catch (error) {
      alert(`Fehler beim Öffnen des Ergebnisses: ${error instanceof Error ? error.message : String(error)}`);
    }
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
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter, activeLibraryId]);

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
      } catch {}
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
      } catch {}
    }
    void loadCounts();
    const t = setInterval(loadCounts, 5000);
    return () => { active = false; clearInterval(t); };
  }, [isOpen, batchFilter, liveUpdates, activeLibraryId]);

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
      // Filter nach aktiver Library, wenn verfügbar
      if (activeLibraryId) {
        params.set('libraryId', activeLibraryId);
      }
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, statusFilter, batchFilter, activeLibraryId]);

  // SSE verbinden IMMER wenn Live-Updates aktiv sind (global fuer Job-Status-Tracking)
  // UI-Liste wird nur aktualisiert wenn Panel geoeffnet ist
  useEffect(() => {
    if (!liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      sseRetryAttemptRef.current = 0;
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
              // Shadow-Twin-Analyse mit kurzem Delay triggern, damit MongoDB-Operationen abgeschlossen sind
              setTimeout(() => triggerShadowTwinAnalysis((v) => v + 1), 400);
              if (evt.sourceItemId) {
                setTimeout(() => clearJobInfo(evt.sourceItemId!), 5000);
              }
            }
          }
          // Refresh der Dateiliste triggern, falls serverseitig Ordner-ID mitgeliefert wird
          // WICHTIG: Refresh sowohl Parent als auch Shadow-Twin-Verzeichnis (falls vorhanden)
          if (evt.refreshFolderId && (evt.status === 'completed' || evt.message === 'stored_local')) {
            try {
              // Refresh alle betroffenen Ordner (Parent + Shadow-Twin)
              const refreshFolderIds = evt.refreshFolderIds || [evt.refreshFolderId]
              refreshFolderIds.forEach(folderId => {
                window.dispatchEvent(new CustomEvent('library_refresh', { 
                  detail: { 
                    folderId,
                    shadowTwinFolderId: evt.shadowTwinFolderId || null,
                    triggerShadowTwinAnalysis: true // Flag für Shadow-Twin-Analyse-Neuberechnung
                  } 
                }))
              })
            } catch {}
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
        } catch {}
      };
      es.addEventListener('job_update', onUpdate as unknown as EventListener);
      // "connected" und "ping" sind Server-Sent Events aus der Stream-Route.
      // Ohne Listener würden wir fälschlicherweise "idle" annehmen und pollen.
      es.addEventListener('connected', () => { lastEventTsRef.current = Date.now(); });
      es.addEventListener('ping', () => { lastEventTsRef.current = Date.now(); });
      es.addEventListener('error', () => {
        try { es.close(); } catch {}
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
          // Shadow-Twin-Analyse mit kurzem Delay triggern, damit MongoDB-Operationen abgeschlossen sind
          setTimeout(() => triggerShadowTwinAnalysis((v) => v + 1), 400);
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
      if (eventRef.current) try { eventRef.current.close(); } catch {}
      window.removeEventListener('job_update_local', onLocal as unknown as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveUpdates, upsertJobStatus, upsertJobInfo, clearJobInfo, triggerShadowTwinAnalysis]);

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
    // Filter nach aktiver Library, wenn verfügbar
    if (activeLibraryId) {
      params.set('libraryId', activeLibraryId);
    }
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
      // Job aus lokalem State entfernen
      setItems(prev => prev.filter(i => i.jobId !== jobId));
      setHiddenIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
      if (openTraces.has(jobId)) setOpenTraces(prev => { const next = new Set(prev); next.delete(jobId); return next; });
      // Liste aktualisieren, um sicherzustellen, dass der Job auch aus der Datenbank entfernt wurde
      await refreshNow();
    } catch (error) {
      console.error('[JobMonitorPanel] Fehler beim Löschen des Jobs', { jobId, error });
      alert(`Löschen fehlgeschlagen: ${error instanceof Error ? error.message : 'Unerwarteter Fehler'}`);
    }
  }

  return (
    <div className="pointer-events-none">
      {/* Handle - im Archiv-Modus (library) und Integration Tests anzeigen, nicht im Gallery-Modus */}
      {(!isGalleryMode || isIntegrationTestsPage) && (
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
                  "border rounded-md p-2",
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
                            className="truncate text-xs font-medium cursor-default flex-1"
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
                      {/* Button zum Öffnen der Datei - wird bei allen Jobs mit sourceItemId angezeigt */}
                      {item.sourceItemId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openJobFile(item);
                                }}
                                className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted text-primary shrink-0"
                                aria-label="Datei öffnen"
                                title="Datei öffnen"
                              >
                                <FolderOpen className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Datei öffnen</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Ergebnis öffnen (Shadow‑Twin Artefakt) */}
                      {item.shadowTwinFolderId && item.resultItemId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openJobResultFile(item);
                                }}
                                className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted text-primary shrink-0"
                                aria-label="Ergebnis öffnen"
                                title="Ergebnis öffnen"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Ergebnis öffnen</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toggleTrace(item.jobId)}
                              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted"
                              aria-label={openTraces.has(item.jobId) ? "Trace ausblenden" : "Trace anzeigen"}
                              title={openTraces.has(item.jobId) ? "Trace ausblenden" : "Trace anzeigen"}
                            >
                              <Activity className={cn("h-3.5 w-3.5", openTraces.has(item.jobId) ? "text-primary" : "text-muted-foreground")} />
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
                              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted"
                              aria-label="Job löschen"
                              title="Job löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
                              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted"
                              aria-label="Als Markdown kopieren"
                              title="Als Markdown kopieren"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Als Markdown kopieren</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                      {item.status !== 'running' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
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
                  <div className="mt-1 text-[10px] text-muted-foreground flex items-center justify-between gap-2">
                    <div className="truncate" title={item.lastMessage}>{item.lastMessage || '—'}</div>
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


