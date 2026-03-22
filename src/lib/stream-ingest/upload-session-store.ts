/**
 * @fileoverview In-Memory-Sessions für /api/stream-ingest (Chunk-Upload vor Secretary-Weiterleitung)
 *
 * Prozess-lokal; bei Server-Restart sind offene Uploads ungültig (explizit, kein stiller Retry).
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type UploadSession = {
  userId: string
  tempPath: string
  contentLength: number
  bytesWritten: number
  nextChunkIndex: number
  fileName: string
  createdAt: number
}

const sessions = new Map<string, UploadSession>()

const TTL_MS = 24 * 60 * 60 * 1000

function pruneStale() {
  const now = Date.now()
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > TTL_MS) {
      try {
        fs.unlinkSync(s.tempPath)
      } catch {
        /* Datei fehlt */
      }
      sessions.delete(id)
    }
  }
}

export function createUploadSession(args: {
  uploadId: string
  userId: string
  contentLength: number
  fileName: string
}): UploadSession {
  pruneStale()
  const tempPath = path.join(
    os.tmpdir(),
    `cks-stream-ingest-${args.uploadId}-${sanitizeFileName(args.fileName)}`
  )
  const session: UploadSession = {
    userId: args.userId,
    tempPath,
    contentLength: args.contentLength,
    bytesWritten: 0,
    nextChunkIndex: 0,
    fileName: args.fileName,
    createdAt: Date.now(),
  }
  sessions.set(args.uploadId, session)
  // Leere Datei anlegen; Chunks werden per append geschrieben
  fs.writeFileSync(tempPath, Buffer.alloc(0))
  return session
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload'
}

export function getUploadSession(uploadId: string): UploadSession | undefined {
  pruneStale()
  return sessions.get(uploadId)
}

export function removeUploadSession(uploadId: string): void {
  const s = sessions.get(uploadId)
  if (s) {
    try {
      fs.unlinkSync(s.tempPath)
    } catch {
      /* ignore */
    }
    sessions.delete(uploadId)
  }
}

export function assertSessionUser(session: UploadSession, userId: string): void {
  if (session.userId !== userId) {
    throw new Error('stream_ingest_forbidden: Upload gehört einem anderen Benutzer')
  }
}
