/**
 * @fileoverview Binär-Chunk für stream-ingest (Reihenfolge strikt: 0,1,2,…)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import * as fs from 'fs'
import {
  getUploadSession,
  assertSessionUser,
} from '@/lib/stream-ingest/upload-session-store'

export async function POST(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const uploadId = request.headers.get('x-upload-id')?.trim()
  const chunkIndexRaw = request.headers.get('x-chunk-index')
  if (!uploadId || chunkIndexRaw === null) {
    return NextResponse.json(
      { error: 'Header X-Upload-Id und X-Chunk-Index sind erforderlich' },
      { status: 400 }
    )
  }

  const chunkIndex = parseInt(chunkIndexRaw, 10)
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: 'X-Chunk-Index ungültig' }, { status: 400 })
  }

  const session = getUploadSession(uploadId)
  if (!session) {
    return NextResponse.json({ error: 'Unbekannte oder abgelaufene uploadId' }, { status: 404 })
  }

  try {
    assertSessionUser(session, userId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 403 })
  }

  if (chunkIndex !== session.nextChunkIndex) {
    return NextResponse.json(
      {
        error: `Chunk-Reihenfolge: erwartet Index ${session.nextChunkIndex}, erhalten ${chunkIndex}`,
      },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await request.arrayBuffer())
  if (buf.length === 0) {
    return NextResponse.json({ error: 'Leerer Chunk nicht erlaubt' }, { status: 400 })
  }

  const remaining = session.contentLength - session.bytesWritten
  if (buf.length > remaining) {
    return NextResponse.json(
      { error: `Chunk zu groß: ${buf.length} Bytes, verbleibend ${remaining}` },
      { status: 400 }
    )
  }

  try {
    fs.appendFileSync(session.tempPath, buf)
  } catch (err) {
    console.error('[stream-ingest/chunk] appendFileSync:', err)
    return NextResponse.json({ error: 'Temporäre Datei konnte nicht geschrieben werden' }, { status: 500 })
  }

  session.bytesWritten += buf.length
  session.nextChunkIndex += 1

  return NextResponse.json({
    ok: true,
    bytesWritten: session.bytesWritten,
    contentLength: session.contentLength,
    nextChunkIndex: session.nextChunkIndex,
  })
}
