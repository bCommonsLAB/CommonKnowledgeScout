/**
 * @fileoverview Start eines Chunk-Uploads für Teams-Video-Relay (Electron → Next → Secretary)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { createUploadSession } from '@/lib/stream-ingest/upload-session-store'

export async function POST(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const fileName =
    typeof b.fileName === 'string' && b.fileName.trim() ? b.fileName.trim() : 'teams-recording.mp4'
  const contentLength = typeof b.contentLength === 'number' ? b.contentLength : Number(b.contentLength)

  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json(
      { error: 'contentLength muss eine positive Zahl sein' },
      { status: 400 }
    )
  }

  const uploadId = randomUUID()
  createUploadSession({
    uploadId,
    userId,
    contentLength,
    fileName,
  })

  return NextResponse.json({ uploadId, contentLength, fileName })
}
