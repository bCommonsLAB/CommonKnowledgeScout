/**
 * @fileoverview External Jobs Worker - Background Worker for Processing External Jobs
 * 
 * @description
 * Singleton worker that processes queued external jobs in the background. Polls MongoDB
 * for queued jobs, claims them atomically, and triggers job execution via API routes.
 * Supports configurable concurrency and polling interval. Auto-starts on server initialization
 * unless explicitly disabled.
 * 
 * @module external-jobs
 * 
 * @exports
 * - ExternalJobsWorker: Singleton worker instance
 * 
 * @usedIn
 * - src/instrumentation.ts: Auto-starts worker on server initialization
 * - src/app/api/external/jobs/worker/route.ts: Worker status endpoint
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for claiming jobs
 * - @/lib/debug/logger: Logging utilities
 * - @/lib/env: Environment helpers for base URL
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';
import { getPublicAppUrl } from '@/lib/env'

type WorkerState = 'stopped' | 'running';

interface WorkerStats {
  startedAt?: number;
  lastTickAt?: number;
  processed: number;
  errors: number;
}

class ExternalJobsWorkerSingleton {
  private static instance: ExternalJobsWorkerSingleton | null = null;
  private state: WorkerState = 'stopped';
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number = Number(process.env.JOBS_WORKER_INTERVAL_MS || '2000');
  private readonly concurrency: number = Number(process.env.JOBS_WORKER_CONCURRENCY || '3');
  private stats: WorkerStats = { processed: 0, errors: 0 };
  private readonly workerId: string = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
    : `${process.pid || 'p'}-${Math.random().toString(36).slice(2, 8)}`;

  static getInstance(): ExternalJobsWorkerSingleton {
    if (!this.instance) this.instance = new ExternalJobsWorkerSingleton();
    return this.instance;
  }

  getStatus(): { state: WorkerState; stats: WorkerStats; intervalMs: number; concurrency: number; workerId: string } {
    return { state: this.state, stats: { ...this.stats }, intervalMs: this.intervalMs, concurrency: this.concurrency, workerId: this.workerId };
  }

  start(): void {
    if (this.state === 'running') return;
    this.state = 'running';
    this.stats.startedAt = Date.now();
    this.intervalId = setInterval(() => { void this.tick(); }, this.intervalMs);
    // Minimal: nur Start/Stop protokollieren
    FileLogger.info('jobs-worker', 'Worker gestartet', { intervalMs: this.intervalMs, concurrency: this.concurrency, workerId: this.workerId });
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.state = 'stopped';
    FileLogger.info('jobs-worker', 'Worker gestoppt', { workerId: this.workerId });
  }

  private async tick(): Promise<void> {
    if (this.state !== 'running') return;
    this.stats.lastTickAt = Date.now();
    try {
      // Keine lauten Tick-Logs mehr
      const repo = new ExternalJobsRepository();
      const baseUrl = getPublicAppUrl();
      const tickId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Worker': 'true',
        'X-Worker-Id': this.workerId,
        'X-Worker-Tick-Id': tickId,
      };
      const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
      if (internalToken) headers['X-Internal-Token'] = internalToken;

      // Diagnose-Ausgaben entfernen – Konsole ruhig halten

      // Globale Concurrency erzwingen: Anzahl currently running respektieren
      const runningNow = await repo.countRunning();
      const availableSlots = Math.max(0, this.concurrency - runningNow);
      if (availableSlots <= 0) {
        // keine laute Ausgabe
        return;
      }

      // Atomare Claims in Concurrency-Schleifen vermeiden Doppelstarts
      const workers = Array.from({ length: availableSlots }).map(async () => {
        try {
          const claimed = await repo.claimNextQueuedJob();
          if (!claimed) return;
          
          FileLogger.info('jobs-worker', 'Job gefunden und wird gestartet', {
            jobId: claimed.jobId,
            jobType: claimed.job_type,
            extractionMethod: (claimed.correlation?.options as { extractionMethod?: string } | undefined)?.extractionMethod,
            workerId: this.workerId
          });
          
          // Trace: Worker-Dispatch als Event
          try { await repo.traceAddEvent(claimed.jobId, { name: 'worker_dispatch', attributes: { workerId: this.workerId } }); } catch {}
          
          // Start-Route triggert die zentrale Ausführung
          const startUrl = `${baseUrl}/api/external/jobs/${claimed.jobId}/start`;
          const startRequestId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          FileLogger.info('jobs-worker', 'Starte Job über Start-Route', {
            jobId: claimed.jobId,
            url: startUrl,
            extractionMethod: (claimed.correlation?.options as { extractionMethod?: string } | undefined)?.extractionMethod,
            tickId,
            startRequestId,
          });
          
          const startHeaders = { ...headers, 'X-Start-Request-Id': startRequestId }
          const startResponse = await fetch(startUrl, { method: 'POST', headers: startHeaders });
          
          FileLogger.info('jobs-worker', 'Start-Route Antwort erhalten', {
            jobId: claimed.jobId,
            status: startResponse.status,
            statusText: startResponse.statusText,
            ok: startResponse.ok
          });
          
          if (!startResponse.ok) {
            const errorText = await startResponse.text().catch(() => 'Keine Fehlermeldung');
            FileLogger.error('jobs-worker', 'Start-Route Fehler', {
              jobId: claimed.jobId,
              status: startResponse.status,
              statusText: startResponse.statusText,
              errorText
            });
            
            // Job als failed markieren, da Start-Route einen Fehler zurückgegeben hat
            try {
              let errorMessage = `Start-Route Fehler: ${startResponse.status} ${startResponse.statusText}`;
              try {
                const errorData = JSON.parse(errorText);
                if (typeof errorData === 'object' && errorData?.error) {
                  errorMessage = String(errorData.error);
                }
              } catch {
                // Fehlertext ist kein JSON - verwende Originaltext
                if (errorText && errorText !== 'Keine Fehlermeldung') {
                  errorMessage = errorText;
                }
              }
              
              await repo.setStatus(claimed.jobId, 'failed', {
                error: { 
                  code: `start_route_${startResponse.status}`, 
                  message: errorMessage 
                }
              });
            } catch (statusError) {
              FileLogger.error('jobs-worker', 'Fehler beim Markieren des Jobs als failed', {
                jobId: claimed.jobId,
                error: statusError instanceof Error ? statusError.message : String(statusError)
              });
            }
            
            throw new Error(`Start-Route Fehler: ${startResponse.status} ${startResponse.statusText} - ${errorText}`);
          }
          
          const startData = await startResponse.json().catch(() => ({}));
          FileLogger.info('jobs-worker', 'Start-Route erfolgreich', {
            jobId: claimed.jobId,
            responseData: startData
          });
          
          this.stats.processed += 1;
        } catch (err) {
          this.stats.errors += 1;
          FileLogger.error('jobs-worker', 'Tick-Fehler', { 
            err: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
          });
        }
      });

      await Promise.all(workers);
      // Ende ohne Info-Log
    } catch (err) {
      this.stats.errors += 1;
      FileLogger.error('jobs-worker', 'Tick-Ausnahme', { err: err instanceof Error ? err.message : String(err) });
    }
  }
}

/**
 * DEV/HMR-SICHERHEIT:
 * In `next dev` kann ein Modul durch Hot-Reload mehrfach evaluiert werden.
 * Wenn dabei neue Singleton-Instanzen entstehen, laufen mehrere Intervalle parallel.
 *
 * Lösung: Singleton-Instanz auf `globalThis` pinnen (pro Node-Prozess).
 */
const globalWorkerKey = '__commonKnowledgeScoutExternalJobsWorker__'
const g = globalThis as unknown as Record<string, unknown>
const existing = g[globalWorkerKey] as ExternalJobsWorkerSingleton | undefined
export const ExternalJobsWorker: ExternalJobsWorkerSingleton =
  existing || (g[globalWorkerKey] = ExternalJobsWorkerSingleton.getInstance()) as ExternalJobsWorkerSingleton

// Auto‑Start: Standardmäßig läuft der Worker immer, außer explizit deaktiviert
try {
  const auto = String(process.env.JOBS_WORKER_AUTOSTART || 'true').toLowerCase();
  if (auto !== 'false') ExternalJobsWorker.start();
} catch {}
















