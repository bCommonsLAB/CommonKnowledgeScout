import { NextRequest, NextResponse } from 'next/server';
import { ExternalJobsWorker } from '@/lib/external-jobs-worker';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';

export async function GET() {
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
  const body = await request.json().catch(() => ({})) as { action?: 'start' | 'stop' | 'tick' };
  
  if (body.action === 'tick') {
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
  
  const action = body.action === 'stop' ? 'stop' : 'start';
  if (action === 'start') ExternalJobsWorker.start(); else ExternalJobsWorker.stop();
  return NextResponse.json(ExternalJobsWorker.getStatus());
}























