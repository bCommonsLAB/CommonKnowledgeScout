import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { describeIndex, fetchVectors, queryVectors } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { LibraryService } from '@/lib/services/library-service'
import { getVectorIndexForLibrary } from '@/lib/chat/config'
import { FileLogger } from '@/lib/debug/logger'

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

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const docModifiedAt = url.searchParams.get('docModifiedAt') || undefined
    const noFallback = url.searchParams.get('noFallback') === '1'
    if (!fileId) return NextResponse.json({ error: 'fileId erforderlich' }, { status: 400 })

    FileLogger.info('file-status', 'Request', { libraryId, fileId, user: userEmail })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    FileLogger.info('file-status', 'Kontext', { libraryId, vectorIndex: ctx.vectorIndex })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) {
      FileLogger.warn('file-status', 'Index nicht gefunden', { libraryId, index: ctx.vectorIndex })
      return NextResponse.json({ status: 'not_indexed' })
    }

    // Hole Meta-Vektor (doc)
    const ids = [`${fileId}-meta`]
    let lookupMethod: 'id' | 'other-index' | 'filter' | 'none' = 'none'
    let foundId: string | undefined
    const fetched = await fetchVectors(idx.host, apiKey, ids, '')
    let meta = fetched[`${fileId}-meta`]?.metadata as Record<string, unknown> | undefined
    if (meta) lookupMethod = 'id'

    // Fallback: Durchsuche andere Library-Indizes des Nutzers (falls Upsert in anderer Library passiert ist)
    if (!meta && !noFallback) {
      const libService = LibraryService.getInstance()
      const libs = await libService.getUserLibraries(userEmail)
      for (const lib of libs) {
        const altIndex = getVectorIndexForLibrary({ id: lib.id, label: lib.label }, lib.config?.chat, userEmail)
        if (altIndex === ctx.vectorIndex) continue
        const alt = await describeIndex(altIndex, apiKey)
        if (!alt?.host) continue
        try {
          const fx = await fetchVectors(alt.host, apiKey, ids, '')
          const m = fx[`${fileId}-meta`]?.metadata as Record<string, unknown> | undefined
          if (m) { meta = m; lookupMethod = 'other-index'; foundId = `${fileId}-meta`; break }
        } catch { /* ignore */ }
      }
    }
    // Zweiter Fallback: gefilterte Query nach fileId/kind='doc' (falls ID-Bildung abweicht)
    if (!meta) {
      try {
        const zero = new Array<number>(3072).fill(0)
        const byFilter = await queryVectors(idx.host, apiKey, zero, 1, {
          user: { $eq: userEmail },
          libraryId: { $eq: libraryId },
          fileId: { $eq: fileId },
          kind: { $eq: 'doc' }
        })
        meta = (byFilter[0]?.metadata ?? undefined) as Record<string, unknown> | undefined
        foundId = byFilter[0]?.id
        if (meta) lookupMethod = 'filter'
      } catch { /* ignore */ }
    }
    if (!meta) {
      FileLogger.info('file-status', 'Not indexed', { libraryId, fileId })
      return NextResponse.json({ status: 'not_indexed' })
    }

    const upsertedAt = typeof meta?.upsertedAt === 'string' ? meta.upsertedAt : undefined
    const chunkCount = typeof meta?.chunkCount === 'number' ? meta.chunkCount : undefined
    const fileName = typeof meta?.fileName === 'string' ? meta.fileName : undefined
    const storedDocMod = typeof meta?.docModifiedAt === 'string' ? meta.docModifiedAt : undefined
    const isStale = !!(docModifiedAt && storedDocMod && new Date(storedDocMod).getTime() < new Date(docModifiedAt).getTime())

    const payload = {
      status: isStale ? 'stale' : 'ok',
      fileId,
      fileName,
      chunkCount,
      upsertedAt,
      docModifiedAt: storedDocMod,
      docMeta: typeof meta?.docMetaJson === 'string' ? JSON.parse(meta.docMetaJson as string) : undefined,
      toc: typeof meta?.tocJson === 'string' ? JSON.parse(meta.tocJson as string) : undefined,
      // Statusfelder (Tooltip)
      extract_status: typeof meta?.extract_status === 'string' ? meta.extract_status : undefined,
      template_status: typeof meta?.template_status === 'string' ? meta.template_status : undefined,
      ingest_status: typeof meta?.ingest_status === 'string' ? meta.ingest_status : undefined,
      process_status: typeof meta?.process_status === 'string' ? meta.process_status : undefined,
      hasError: typeof meta?.hasError === 'boolean' ? meta.hasError : undefined,
      errorCode: typeof meta?.errorCode === 'string' ? meta.errorCode : undefined,
      errorMessage: typeof meta?.errorMessage === 'string' ? meta.errorMessage : undefined,
      _debug: { lookupMethod, expectedId: `${fileId}-meta`, foundId }
    }
    FileLogger.info('file-status', 'Response', { libraryId, fileId, status: payload.status, lookupMethod })
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


