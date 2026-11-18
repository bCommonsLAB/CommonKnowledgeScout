import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsWorker } from '@/lib/external-jobs-worker';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';
import { getPreferredUserEmail } from '@/lib/auth/user-email';

/**
 * Verwaltung des Job-Workers (Status lesen, starten, stoppen, sofort ticken).
 *
 * Sicherheit (Befund 18.11.2026): Die Middleware liess frueher jeden POST unter
 * `/api/external/jobs/` anonym durch — damit konnte jeder den Prod-Worker anhalten.
 * Die Middleware verlangt hier jetzt eine Session (`isAnonymousExternalJobsRoute`);
 * die Route prueft zusaetzlich selbst, damit eine spaeter wieder zu weit gefasste
 * Ausnahme den Worker nicht erneut oeffnet. Interne Aufrufer stossen den Worker
 * im Prozess an (`ExternalJobsWorker.tickNow()`), nicht ueber diese Route.
 */

type WorkerAction = 'start' | 'stop' | 'tick';
const WORKER_ACTIONS: ReadonlySet<string> = new Set<WorkerAction>(['start', 'stop', 'tick']);

function isWorkerAction(value: unknown): value is WorkerAction {
  return typeof value === 'string' && WORKER_ACTIONS.has(value);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

  const status = ExternalJobsWorker.getStatus();

  // Pool-Diagnose: Wie viele Jobs blockieren global Concurrency-Slots, und wie viele davon
  // sind „stale running“ (Kandidaten fuer den Reaper)? Bewusst ohne User-Filter, weil
  // `countRunning` im Worker auch ohne User-Filter zaehlt — dieselbe Sicht muss die UI haben.
  const repo = new ExternalJobsRepository();
  const thresholdMs = ExternalJobsWorker.getReaperMaxAgeMs();
  let runningInPool: number | null = null;
  let staleRunningInPool: number | null = null;
  try {
    const [r, s] = await Promise.all([
      repo.countRunning(),
      repo.countStaleRunning(thresholdMs),
    ]);
    runningInPool = r;
    staleRunningInPool = s;
  } catch (err) {
    // Mongo-Probleme duerfen Status-Abruf nicht killen — UI zeigt „—“ und Health-Issue bleibt sichtbar.
    FileLogger.warn('jobs-worker', 'Pool-Counts nicht abrufbar', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({
    ...status,
    pool: {
      runningInPool,
      staleRunningInPool,
      staleThresholdMs: thresholdMs,
    },
  });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  const userEmail = getPreferredUserEmail(await currentUser());
  if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body muss JSON sein: {"action":"start"|"stop"|"tick"}' }, { status: 400 });
  }
  const action = (raw && typeof raw === 'object') ? (raw as { action?: unknown }).action : undefined;
  if (!isWorkerAction(action)) {
    return NextResponse.json(
      { error: `Unbekannte Worker-Aktion: ${JSON.stringify(action ?? null)} (erlaubt: start, stop, tick)` },
      { status: 400 },
    );
  }

  // start/stop veraendern den Worker fuer alle — wer das ausloest, steht im Log.
  if (action !== 'tick') FileLogger.info('jobs-worker', `Worker-Aktion ${action}`, { userEmail });

  if (action === 'tick') {
    // Sofortiger Tick: Worker starten falls noetig und sofort Jobs verarbeiten
    // Prüfe ob tickNow verfügbar ist (für Webpack-Kompatibilität)
    if (typeof ExternalJobsWorker.tickNow === 'function') {
      await ExternalJobsWorker.tickNow();
    } else {
      // Fallback: Worker starten falls nicht läuft
      if (ExternalJobsWorker.getStatus().state !== 'running') {
        ExternalJobsWorker.start();
      }
    }
    return NextResponse.json({ ...ExternalJobsWorker.getStatus(), tickTriggered: true });
  }

  if (action === 'start') ExternalJobsWorker.start(); else ExternalJobsWorker.stop();
  return NextResponse.json(ExternalJobsWorker.getStatus());
}
