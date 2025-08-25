import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { drainBufferedLogs } from '@/lib/external-jobs-log-buffer';

interface WatchdogContext {
  jobId: string;
  userEmail: string;
  jobType?: string;
  fileName?: string;
}

type WatchdogEntry = { timer: ReturnType<typeof setTimeout>; updatedAtMs: number; ctx: WatchdogContext; timeoutMs: number };

declare const global: typeof globalThis & { __jobWatchdog?: Map<string, WatchdogEntry> };

function getStore(): Map<string, WatchdogEntry> {
  if (!global.__jobWatchdog) global.__jobWatchdog = new Map();
  return global.__jobWatchdog;
}

async function onTimeout(jobId: string, entry: WatchdogEntry): Promise<void> {
  try {
    const repo = new ExternalJobsRepository();
    // Persistiere gepufferte Logs zuerst
    const buffered = drainBufferedLogs(jobId);
    for (const e of buffered) {
      await repo.appendLog(jobId, e as unknown as Record<string, unknown>);
    }
    // Timeout-Log hinzufügen
    await repo.appendLog(jobId, { phase: 'failed', message: `Keine Rückmeldung vom Worker seit ${Math.floor(entry.timeoutMs / 1000)}s (Timeout)` });
    // Status setzen
    await repo.setStatus(jobId, 'failed', { error: { code: 'timeout', message: 'Worker-Timeout', details: { idleMs: entry.timeoutMs } } });
    // Live-Event
    getJobEventBus().emitUpdate(entry.ctx.userEmail, {
      type: 'job_update',
      jobId,
      status: 'failed',
      message: 'timeout',
      updatedAt: new Date().toISOString(),
      jobType: entry.ctx.jobType,
      fileName: entry.ctx.fileName,
    });
  } finally {
    // Immer aufräumen
    getStore().delete(jobId);
  }
}

function schedule(jobId: string, entry: WatchdogEntry) {
  const timer = setTimeout(() => { void onTimeout(jobId, entry); }, entry.timeoutMs);
  entry.timer = timer;
}

export function startWatchdog(ctx: WatchdogContext, timeoutMs: number = 240_000): void {
  const store = getStore();
  const now = Date.now();
  const existing = store.get(ctx.jobId);
  if (existing) {
    clearTimeout(existing.timer);
  }
  const entry: WatchdogEntry = { ctx, updatedAtMs: now, timeoutMs, timer: setTimeout(() => {}, 0) };
  clearTimeout(entry.timer);
  schedule(ctx.jobId, entry);
  store.set(ctx.jobId, entry);
}

export function bumpWatchdog(jobId: string, timeoutMs?: number): void {
  const store = getStore();
  const entry = store.get(jobId);
  if (!entry) return;
  if (timeoutMs && timeoutMs !== entry.timeoutMs) entry.timeoutMs = timeoutMs;
  entry.updatedAtMs = Date.now();
  clearTimeout(entry.timer);
  schedule(jobId, entry);
}

export function clearWatchdog(jobId: string): void {
  const store = getStore();
  const entry = store.get(jobId);
  if (!entry) return;
  clearTimeout(entry.timer);
  store.delete(jobId);
}


