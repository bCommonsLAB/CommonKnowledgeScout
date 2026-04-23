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
import { getJobsWorkerPoolId, getPublicAppUrl } from '@/lib/env'

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
  /**
   * Hartes Timeout für den `fetch()` an `/api/external/jobs/[jobId]/start`.
   * Default 60 s — deutlich kürzer als undici-Default (300 s), damit Hänger früh sichtbar werden.
   * Konfigurierbar via `JOBS_WORKER_START_TIMEOUT_MS`.
   */
  private readonly startFetchTimeoutMs: number = Number(process.env.JOBS_WORKER_START_TIMEOUT_MS || '60000');
  /**
   * Maximale Wiederhol-Versuche, bevor der Job bei wiederholtem Worker-Dispatch-Fehler endgültig fehlschlägt.
   * Default 3 — schützt gegen kurzzeitige HMR-/Compile-Hänger im Dev-Modus.
   */
  private readonly startMaxAttempts: number = Number(process.env.JOBS_WORKER_START_MAX_ATTEMPTS || '3');
  private stats: WorkerStats = { processed: 0, errors: 0 };
  private readonly workerId: string = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
    : `${process.pid || 'p'}-${Math.random().toString(36).slice(2, 8)}`;

  static getInstance(): ExternalJobsWorkerSingleton {
    if (!this.instance) this.instance = new ExternalJobsWorkerSingleton();
    return this.instance;
  }

  getStatus(): { state: WorkerState; stats: WorkerStats; intervalMs: number; concurrency: number; workerId: string; jobsWorkerPoolId: string } {
    return {
      state: this.state,
      stats: { ...this.stats },
      intervalMs: this.intervalMs,
      concurrency: this.concurrency,
      workerId: this.workerId,
      jobsWorkerPoolId: getJobsWorkerPoolId(),
    };
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

  /**
   * Triggert sofort einen Tick, um wartende Jobs ohne Verzoegerung zu verarbeiten.
   * Startet den Worker automatisch, wenn er nicht laeuft.
   */
  async tickNow(): Promise<void> {
    // Worker starten falls nicht laeuft
    if (this.state !== 'running') {
      this.start();
    }
    // Sofort einen Tick ausfuehren
    await this.tick();
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
        let claimed: Awaited<ReturnType<typeof repo.claimNextQueuedJob>> = null;
        try {
          claimed = await repo.claimNextQueuedJob();
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
          // Hartes Timeout via AbortController.
          // Ohne dieses Timeout würden wir auf den undici-Default (300 s headersTimeout) warten,
          // bevor wir überhaupt erfahren, dass der `/start`-Handler hängt.
          // Mit AbortController scheitert der fetch nach `startFetchTimeoutMs` mit `AbortError`.
          const startController = new AbortController();
          const startTimeoutHandle = setTimeout(() => startController.abort(), this.startFetchTimeoutMs);
          const fetchStartedAt = Date.now();
          let startResponse: Response;
          try {
            startResponse = await fetch(startUrl, { method: 'POST', headers: startHeaders, signal: startController.signal });
          } finally {
            clearTimeout(startTimeoutHandle);
          }
          const fetchElapsedMs = Date.now() - fetchStartedAt;

          FileLogger.info('jobs-worker', 'Start-Route Antwort erhalten', {
            jobId: claimed.jobId,
            status: startResponse.status,
            statusText: startResponse.statusText,
            ok: startResponse.ok,
            elapsedMs: fetchElapsedMs,
            timeoutMs: this.startFetchTimeoutMs,
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
          const errMsg = err instanceof Error ? err.message : String(err);
          const errName = err instanceof Error ? err.name : 'UnknownError';
          // AbortError = unser Timeout hat zugeschlagen. Andere Fehler aus der fetch-Phase
          // (DNS, TCP-Reset, ECONNREFUSED) kommen als `TypeError: fetch failed` mit `cause`.
          const isAbort = errName === 'AbortError';
          // `cause` aus undici aufdecken — sonst sehen wir nur "fetch failed".
          const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause?: unknown }).cause : undefined;
          const causeMessage = cause instanceof Error ? cause.message : (cause ? String(cause) : undefined);
          const causeCode = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : undefined;

          FileLogger.error('jobs-worker', isAbort ? 'Worker-Dispatch Timeout' : 'Worker-Dispatch Fehler', {
            jobId: claimed?.jobId,
            err: errMsg,
            errName,
            causeMessage,
            causeCode,
            timeoutMs: this.startFetchTimeoutMs,
            stack: err instanceof Error ? err.stack : undefined,
          });

          // Wenn wir keinen claim haben, ist der Fehler nicht jobspezifisch — nichts zu requeuen.
          if (!claimed) return;

          // Worker konnte die `/start`-Route nicht erreichen → Requeue mit Versuchszähler.
          // Das schützt gegen kurzlebige Hänger (Next-HMR-Compile, kurzfristige Mongo-/DNS-Probleme),
          // gibt aber nach `startMaxAttempts` Versuchen sauber auf, statt endlos zu loopen.
          try {
            const reason = isAbort ? 'fetch_timeout' : (causeCode || 'fetch_failed');
            const detailedMessage = causeMessage ? `${errMsg} (cause: ${causeMessage})` : errMsg;
            const result = await repo.requeueAfterStartFailure(claimed.jobId, detailedMessage, {
              maxAttempts: this.startMaxAttempts,
              reason,
            });
            FileLogger.warn('jobs-worker', 'Requeue-Entscheidung getroffen', {
              jobId: claimed.jobId,
              attempts: result.attempts,
              maxAttempts: this.startMaxAttempts,
              finalStatus: result.finalStatus,
              reason,
            });
          } catch (requeueErr) {
            FileLogger.error('jobs-worker', 'Konnte Requeue/Failed-Update nicht durchführen', {
              jobId: claimed.jobId,
              error: requeueErr instanceof Error ? requeueErr.message : String(requeueErr),
            });
          }
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
















