import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, getByFileIds } from '@/lib/repositories/vector-repo'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'

/**
 * GET /api/chat/[libraryId]/doc-meta
 * Lädt Dokument-Metadaten aus MongoDB 
 * 
 * Query-Parameter:
 * - fileId: Die ID der Datei (erforderlich)
 * 
 * Response:
 * {
 *   exists: boolean
 *   fileId?: string
 *   fileName?: string
 *   docMetaJson?: Record<string, unknown>  // Komplettes docMetaJson-Objekt
 *   chunkCount?: number
 *   chaptersCount?: number
 *   upsertedAt?: string
 *   // Top-Level Felder für Facetten
 *   event?: string
 *   track?: string
 *   speakers_url?: string[]
 *   speakers_image_url?: string[]
 *   tags?: string[]
 *   topics?: string[]
 *   year?: number | string
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    // Chat-Kontext laden (unterstützt auch öffentliche Libraries ohne Email)
    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    if (!fileId) {
      return NextResponse.json({ error: 'fileId erforderlich' }, { status: 400 })
    }

    // Verwende Collection-Name aus Config (deterministisch, keine Owner-Email-Ermittlung mehr)
    const libraryKey = getCollectionNameForLibrary(ctx.library)

    // Dokument aus MongoDB laden
    const map = await getByFileIds(libraryKey, libraryId, [fileId])
    const docMeta = map.get(fileId)

    if (!docMeta) {
      return NextResponse.json({ exists: false })
    }

    // Response zusammenstellen (alle Daten direkt aus MongoDB)
    // Security: Bei öffentlichen Libraries dürfen bestimmte Felder nicht an anonyme/gewöhnliche Viewer geleakt werden.
    // Beispiel: `testimonialWriteKey` ermöglicht (anonyme) Uploads. Dieses Feld ist für Moderatoren/Owner gedacht.
    const docMetaJsonRaw = (docMeta.docMetaJson && typeof docMeta.docMetaJson === 'object')
      ? docMeta.docMetaJson as Record<string, unknown>
      : undefined

    // Wenn Library nicht public ist, ist diese Route ohnehin auth-protected (siehe oben).
    // Für public: nur Owner/Moderator dürfen Secrets sehen.
    const isOwnerOrMod = (userId && userEmail)
      ? await isModeratorOrOwner(libraryId, userEmail)
      : false
    const canSeeSecrets = !ctx.library.config?.publicPublishing?.isPublic || isOwnerOrMod

    const docMetaJson = (() => {
      if (!docMetaJsonRaw) return undefined
      // Avoid mutating cached objects from Mongo driver
      const cloned: Record<string, unknown> = { ...docMetaJsonRaw }
      if (!canSeeSecrets) {
        delete cloned.testimonialWriteKey
      }
      return cloned
    })()

    const response = {
      exists: true,
      fileId: typeof docMeta.fileId === 'string' ? docMeta.fileId : undefined,
      fileName: typeof docMeta.fileName === 'string' ? docMeta.fileName : undefined,
      // Komplettes docMetaJson-Objekt
      docMetaJson,
      // Top-Level chapters Feld (falls vorhanden)
      chapters: Array.isArray(docMeta.chapters) ? docMeta.chapters : undefined,
      // Technische Felder
      chunkCount: typeof docMeta.chunkCount === 'number' ? docMeta.chunkCount : undefined,
      chaptersCount: typeof docMeta.chaptersCount === 'number' ? docMeta.chaptersCount : undefined,
      upsertedAt: typeof docMeta.upsertedAt === 'string' ? docMeta.upsertedAt : undefined,
      // Top-Level Felder (für Facetten-Kompatibilität)
      event: typeof docMeta.event === 'string' ? docMeta.event : undefined,
      track: typeof docMeta.track === 'string' ? docMeta.track : undefined,
      speakers: Array.isArray(docMeta.speakers) ? docMeta.speakers as string[] : undefined,
      speakers_url: Array.isArray(docMeta.speakers_url) ? docMeta.speakers_url as string[] : undefined,
      speakers_image_url: Array.isArray(docMeta.speakers_image_url) ? docMeta.speakers_image_url as string[] : undefined,
      tags: Array.isArray(docMeta.tags) ? docMeta.tags as string[] : undefined,
      topics: Array.isArray(docMeta.topics) ? docMeta.topics as string[] : undefined,
      year: docMeta.year,
    }

    return NextResponse.json(response)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    console.error('[doc-meta] ERROR', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

