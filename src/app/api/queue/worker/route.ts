import '@/lib/observability/apm2'
import { NextResponse } from 'next/server'
import { getSimpleWorkerStatus, startSimpleWorker, ensureSimpleWorkerStarted } from '@/lib/simple-worker'

export const runtime = 'nodejs'

export async function GET() {
  ensureSimpleWorkerStarted()
  return NextResponse.json(getSimpleWorkerStatus())
}

export async function POST() {
  startSimpleWorker()
  return NextResponse.json(getSimpleWorkerStatus())
}


