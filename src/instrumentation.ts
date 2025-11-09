/**
 * @fileoverview Next.js Instrumentation - External Jobs Worker Startup
 * 
 * @description
 * Next.js instrumentation hook that starts the External Jobs Worker on server startup.
 * Uses dynamic require to avoid bundling Node-only dependencies. Runs in best-effort
 * mode without propagating exceptions.
 * 
 * @module core
 * 
 * @exports
 * - register(): Starts external jobs worker on server initialization
 * 
 * @usedIn
 * - Next.js framework: Automatically called during server startup
 * 
 * @dependencies
 * - @/lib/external-jobs-worker: External jobs worker implementation
 */

export async function register(): Promise<void> {
  try {
    // Dynamischer require vermeidet bundling von Node-only Abhängigkeiten (dotenv/path)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = (0, eval)('require') as (id: string) => unknown;
    const mod = req('./lib/external-jobs-worker') as { ExternalJobsWorker?: { start: () => void } };
    mod?.ExternalJobsWorker?.start();
  } catch {
    // best-effort, keine Exceptions propagieren
  }
}


