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
      const repo = new ExternalJobsRepository();
      const queued = await repo.listQueued(this.concurrency);
      if (this.state !== 'running') return; // Hard gate: erneut prüfen
      if (queued.length === 0) return;

      await Promise.all(
        queued.map(async (job) => {
          try {
            // Nutze bestehende Retry-Route, damit die Ausführung zentral bleibt
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
            if (!appUrl) return;
            if (this.state !== 'running') return; // Hard gate kurze Zeit vor dem Call
            await fetch(`${appUrl.replace(/\/$/, '')}/api/external/jobs/${job.jobId}/retry`, { method: 'POST' });
            this.stats.processed += 1;
          } catch (err) {
            this.stats.errors += 1;
            FileLogger.error('jobs-worker', 'Tick-Fehler', { jobId: job.jobId, err: err instanceof Error ? err.message : String(err) });
          }
        })
      );
    } catch (err) {
      this.stats.errors += 1;
      FileLogger.error('jobs-worker', 'Tick-Ausnahme', { err: err instanceof Error ? err.message : String(err) });
    }
  }
}

export const ExternalJobsWorker = ExternalJobsWorkerSingleton.getInstance();
















