import { NextRequest, NextResponse } from 'next/server'
import { SimpleQueueRepository } from '@/lib/simple-queue-repository'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const repo = new SimpleQueueRepository()
    const job = await repo.get(id)
    if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ id: job.id, status: job.status, steps: job.steps, logs: job.logs, error: job.error })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 })
  }
}


