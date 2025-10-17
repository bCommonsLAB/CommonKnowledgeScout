import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';

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

  static getInstance(): ExternalJobsWorkerSingleton {
    if (!this.instance) this.instance = new ExternalJobsWorkerSingleton();
    return this.instance;
  }

  getStatus(): { state: WorkerState; stats: WorkerStats; intervalMs: number; concurrency: number } {
    return { state: this.state, stats: { ...this.stats }, intervalMs: this.intervalMs, concurrency: this.concurrency };
  }

  start(): void {
    if (this.state === 'running') return;
    this.state = 'running';
    this.stats.startedAt = Date.now();
    this.intervalId = setInterval(() => { void this.tick(); }, this.intervalMs);
    FileLogger.info('jobs-worker', 'Worker gestartet', { intervalMs: this.intervalMs, concurrency: this.concurrency });
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.state = 'stopped';
    FileLogger.info('jobs-worker', 'Worker gestoppt');
  }

  private async tick(): Promise<void> {
    if (this.state !== 'running') return;
    this.stats.lastTickAt = Date.now();
    try {
      FileLogger.info('jobs-worker', 'tick_start', { at: new Date().toISOString() });
      const repo = new ExternalJobsRepository();
      const appUrlPreferred = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const port = String(process.env.PORT || '3000');
      const localBase = `http://127.0.0.1:${port}`;
      const baseUrl = appUrlPreferred || localBase;
      FileLogger.info('jobs-worker', 'dispatch_base_url', { baseUrl });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Worker': 'true' };
      const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
      if (internalToken) headers['X-Internal-Token'] = internalToken;

      // Diagnose: momentanen Queue-Snapshot protokollieren (ohne zu claimen)
      try {
        const snapshot = await repo.listQueued(5);
        FileLogger.info('jobs-worker', 'queued_snapshot', { count: snapshot.length, jobIds: snapshot.map(j => j.jobId) });
      } catch {}

      // Globale Concurrency erzwingen: Anzahl currently running respektieren
      const runningNow = await repo.countRunning();
      const availableSlots = Math.max(0, this.concurrency - runningNow);
      if (availableSlots <= 0) {
        FileLogger.info('jobs-worker', 'concurrency_saturated', { runningNow, concurrency: this.concurrency });
        return;
      }

      // Atomare Claims in Concurrency-Schleifen vermeiden Doppelstarts
      const workers = Array.from({ length: availableSlots }).map(async () => {
        try {
          const claimed = await repo.claimNextQueuedJob();
          if (!claimed) return;
          FileLogger.info('jobs-worker', 'claimed_job', { jobId: claimed.jobId });
          // Retry-Route triggert die zentrale Ausführung
          await fetch(`${baseUrl}/api/external/jobs/${claimed.jobId}/retry`, { method: 'POST', headers });
          FileLogger.info('jobs-worker', 'dispatched_retry', { jobId: claimed.jobId });
          this.stats.processed += 1;
        } catch (err) {
          this.stats.errors += 1;
          FileLogger.error('jobs-worker', 'Tick-Fehler', { err: err instanceof Error ? err.message : String(err) });
        }
      });

      await Promise.all(workers);
      FileLogger.info('jobs-worker', 'tick_end', { processed: this.stats.processed, errors: this.stats.errors });
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
















