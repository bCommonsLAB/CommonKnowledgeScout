import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'
import { getCollectionNameForLibrary, getMetaByFileId } from '@/lib/repositories/vector-repo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const docModifiedAt = url.searchParams.get('docModifiedAt') || undefined
    const noFallback = url.searchParams.get('noFallback') === '1'
    if (!fileId) return NextResponse.json({ error: 'fileId erforderlich' }, { status: 400 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    let lookupMethod: 'id' | 'other-index' | 'filter' | 'none' = 'none'
    let foundId: string | undefined
    
    // Hole Meta-Dokument direkt aus MongoDB
    let metaDoc = await getMetaByFileId(libraryKey, fileId)
    if (metaDoc) {
      lookupMethod = 'id'
      foundId = `${fileId}-meta`
    }

    // Fallback: Durchsuche andere Library-Collections des Nutzers (falls Upsert in anderer Library passiert ist)
    if (!metaDoc && !noFallback) {
      const libService = LibraryService.getInstance()
      const libs = await libService.getUserLibraries(userEmail)
      for (const lib of libs) {
        if (lib.id === libraryId) continue
        try {
          const altLibraryKey = getCollectionNameForLibrary(lib)
          const altMeta = await getMetaByFileId(altLibraryKey, fileId)
          if (altMeta) {
            metaDoc = altMeta
            lookupMethod = 'other-index'
            foundId = `${fileId}-meta`
            break
          }
        } catch { /* ignore */ }
      }
    }
    
    if (!metaDoc) {
      FileLogger.info('file-status', 'Not indexed', { libraryId, fileId })
      return NextResponse.json({ status: 'not_indexed' })
    }
    
    const meta = metaDoc as unknown as Record<string, unknown>

    const upsertedAt = typeof meta.upsertedAt === 'string' ? meta.upsertedAt : undefined
    const chunkCount = typeof meta.chunkCount === 'number' ? meta.chunkCount : undefined
    const chaptersCount = typeof meta.chaptersCount === 'number' ? meta.chaptersCount : undefined
    const fileName = typeof meta.fileName === 'string' ? meta.fileName : undefined
    const storedDocMod = typeof meta.docModifiedAt === 'string' ? meta.docModifiedAt : undefined
    const isStale = !!(docModifiedAt && storedDocMod && new Date(storedDocMod).getTime() < new Date(docModifiedAt).getTime())
    
    // docMetaJson kann Objekt oder String sein
    let docMeta: Record<string, unknown> | undefined = undefined
    if (meta.docMetaJson) {
      if (typeof meta.docMetaJson === 'string') {
        try {
          docMeta = JSON.parse(meta.docMetaJson) as Record<string, unknown>
        } catch {
          // Ignore parse error
        }
      } else if (typeof meta.docMetaJson === 'object') {
        docMeta = meta.docMetaJson as Record<string, unknown>
      }
    }

    const payload = {
      status: isStale ? 'stale' : 'ok',
      fileId,
      fileName,
      upsertedAt,
      docModifiedAt: storedDocMod,
      docMeta,
      toc: typeof meta.tocJson === 'string' ? JSON.parse(meta.tocJson as string) : undefined,
      chunkCount,
      chaptersCount,
      // Statusfelder (Tooltip)
      extract_status: typeof meta.extract_status === 'string' ? meta.extract_status : undefined,
      template_status: typeof meta.template_status === 'string' ? meta.template_status : undefined,
      ingest_status: typeof meta.ingest_status === 'string' ? meta.ingest_status : undefined,
      process_status: typeof meta.process_status === 'string' ? meta.process_status : undefined,
      hasError: typeof meta.hasError === 'boolean' ? meta.hasError : undefined,
      errorCode: typeof meta.errorCode === 'string' ? meta.errorCode : undefined,
      errorMessage: typeof meta.errorMessage === 'string' ? meta.errorMessage : undefined,
      _debug: { lookupMethod, expectedId: `${fileId}-meta`, foundId }
    }
    // Response Log entfernt (zu viele Logs bei jedem Response)
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


