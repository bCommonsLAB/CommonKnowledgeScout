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
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Worker': 'true', 'X-Worker-Id': this.workerId };
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
          // Trace: Worker-Dispatch als Event
          try { await repo.traceAddEvent(claimed.jobId, { name: 'worker_dispatch', attributes: { workerId: this.workerId } }); } catch {}
          // Start-Route triggert die zentrale Ausführung
          await fetch(`${baseUrl}/api/external/jobs/${claimed.jobId}/start`, { method: 'POST', headers });
          this.stats.processed += 1;
        } catch (err) {
          this.stats.errors += 1;
          FileLogger.error('jobs-worker', 'Tick-Fehler', { err: err instanceof Error ? err.message : String(err) });
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

export const ExternalJobsWorker = ExternalJobsWorkerSingleton.getInstance();

// Auto‑Start: Standardmäßig läuft der Worker immer, außer explizit deaktiviert
try {
  const auto = String(process.env.JOBS_WORKER_AUTOSTART || 'true').toLowerCase();
  if (auto !== 'false') ExternalJobsWorker.start();
} catch {}
















