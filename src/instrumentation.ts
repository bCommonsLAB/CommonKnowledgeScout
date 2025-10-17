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


