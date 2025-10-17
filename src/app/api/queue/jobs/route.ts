import { NextRequest, NextResponse } from 'next/server'
import { SimpleQueueRepository } from '@/lib/simple-queue-repository'
import { ensureSimpleWorkerStarted } from '@/lib/simple-worker'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    ensureSimpleWorkerStarted()
    const body = await request.json().catch(() => ({})) as {
      id: string
      payload: { userEmail: string; libraryId: string; source: { itemId: string; parentId: string; name?: string; mimeType?: string }; options?: Record<string, unknown> }
    }
    if (!body?.id || !body?.payload?.userEmail || !body?.payload?.libraryId || !body?.payload?.source?.itemId || !body?.payload?.source?.parentId) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
    }
    const repo = new SimpleQueueRepository()
    await repo.enqueue({ id: body.id, type: 'pdf', payload: body.payload })
    return NextResponse.json({ ok: true, id: body.id }, { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const limit = Number(url.searchParams.get('limit') || '20')
    const repo = new SimpleQueueRepository()
    const res = await repo.list(page, limit)
    return NextResponse.json(res)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 })
  }
}


