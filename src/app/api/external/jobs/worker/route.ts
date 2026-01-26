import { NextRequest, NextResponse } from 'next/server';
import { ExternalJobsWorker } from '@/lib/external-jobs-worker';

export async function GET() {
  const status = ExternalJobsWorker.getStatus();
  return NextResponse.json(status);
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























