import { NextRequest, NextResponse } from 'next/server';
import { ExternalJobsWorker } from '@/lib/external-jobs-worker';

export async function GET() {
  const status = ExternalJobsWorker.getStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { action?: 'start' | 'stop' };
  const action = body.action === 'stop' ? 'stop' : 'start';
  if (action === 'start') ExternalJobsWorker.start(); else ExternalJobsWorker.stop();
  return NextResponse.json(ExternalJobsWorker.getStatus());
}


















