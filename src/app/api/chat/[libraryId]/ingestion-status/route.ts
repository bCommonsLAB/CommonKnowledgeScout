import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { describeIndex, fetchVectors, queryVectors } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { FileLogger } from '@/lib/debug/logger'

interface ChapterDto {
  chapterId: string
  title?: string
  order?: number
  startChunk?: number
  endChunk?: number
  chunkCount?: number
  startPage?: number
  endPage?: number
  summary?: string
  keywords?: string[]
  upsertedAt?: string
}

interface IngestionStatusDto {
  indexExists: boolean
  doc: {
    exists: boolean
    status: 'ok' | 'stale' | 'not_indexed'
    fileName?: string
    title?: string
    user?: string
    chunkCount?: number
    chaptersCount?: number
    upsertedAt?: string
    docModifiedAt?: string
    // zusätzliche, aus docMetaJson extrahierte Felder
    authors?: string[]
    year?: number | string
    pages?: number
    region?: string
    docType?: string
    source?: string
    issue?: string | number
    language?: string
    topics?: string[]
    summary?: string
  }
  chapters: ChapterDto[]
}

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
    if (!fileId) return NextResponse.json({ error: 'fileId erforderlich' }, { status: 400 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) {
      FileLogger.warn('ingestion-status', 'Index nicht gefunden', { libraryId, index: ctx.vectorIndex })
      const payload: IngestionStatusDto = {
        indexExists: false,
        doc: { exists: false, status: 'not_indexed' },
        chapters: [],
      }
      return NextResponse.json(payload)
    }

    // Doc-Meta laden (kein Cross-Index-/Filter-Fallback)
    const fetched = await fetchVectors(idx.host, apiKey, [`${fileId}-meta`], '')
    let meta = fetched[`${fileId}-meta`]?.metadata as Record<string, unknown> | undefined
    // Robustheit innerhalb DESSELBEN Indexes: Metadaten-Filter auf fileId/kind='doc'
    if (!meta) {
      try {
        const zero = new Array<number>(3072).fill(0)
        const byFilter = await queryVectors(idx.host, apiKey, zero, 1, {
          user: { $eq: userEmail },
          libraryId: { $eq: libraryId },
          fileId: { $eq: fileId },
          kind: { $eq: 'doc' },
        })
        meta = (byFilter[0]?.metadata ?? undefined) as Record<string, unknown> | undefined
      } catch { /* ignore */ }
    }
    if (!meta) {
      const payload: IngestionStatusDto = {
        indexExists: true,
        doc: { exists: false, status: 'not_indexed' },
        chapters: [],
      }
      return NextResponse.json(payload)
    }

    const upsertedAt = typeof meta.upsertedAt === 'string' ? meta.upsertedAt : undefined
    const storedDocMod = typeof meta.docModifiedAt === 'string' ? meta.docModifiedAt : undefined
    const isStale = !!(docModifiedAt && storedDocMod && new Date(storedDocMod).getTime() < new Date(docModifiedAt).getTime())
    const fileName = typeof meta.fileName === 'string' ? meta.fileName : undefined
    const userMeta = typeof meta.user === 'string' ? meta.user : undefined
    const chunkCount = typeof meta.chunkCount === 'number' ? meta.chunkCount : undefined
    const chaptersCount = typeof meta.chaptersCount === 'number' ? meta.chaptersCount : undefined

    const docMetaObj = typeof meta.docMetaJson === 'string' ? safeParseJson(meta.docMetaJson) : undefined
    const title = docMetaObj && typeof (docMetaObj as { title?: unknown }).title === 'string' ? normalizeStr((docMetaObj as { title?: string }).title) : undefined
    const authors = normStrArr((docMetaObj as Record<string, unknown>)?.authors)
    const year = normalizeMaybeNumber((docMetaObj as Record<string, unknown>)?.year)
    const pagesNum = normalizeMaybeNumber((docMetaObj as Record<string, unknown>)?.pages)
    const regionStr = normalizeStr((docMetaObj as Record<string, unknown>)?.region)
    const docTypeStr = normalizeStr((docMetaObj as Record<string, unknown>)?.docType)
    const sourceStr = normalizeStr((docMetaObj as Record<string, unknown>)?.source)
    const issueVal = ((): string | number | undefined => {
      const v = (docMetaObj as Record<string, unknown>)?.issue
      if (typeof v === 'number') return v
      const s = normalizeStr(v)
      if (!s) return undefined
      const n = Number(s)
      return Number.isFinite(n) ? n : s
    })()
    const languageStr = normalizeStr((docMetaObj as Record<string, unknown>)?.language)
    const topicsArr = normStrArr((docMetaObj as Record<string, unknown>)?.topics)
    const summaryStr = normalizeStr((docMetaObj as Record<string, unknown>)?.summary) || normalizeStr((docMetaObj as Record<string, unknown>)?.teaser)

    const toc = typeof meta.tocJson === 'string' ? safeParseJson(meta.tocJson) as Array<Record<string, unknown>> | undefined : undefined

    // Kapitel-Grunddaten: bevorzugt tocJson; andernfalls chapters aus docMetaJson
    const chaptersMap = new Map<string, ChapterDto>()
    const pushChapter = (key: string, dto: ChapterDto) => {
      const prev = chaptersMap.get(key)
      chaptersMap.set(key, { ...(prev || {}), ...dto })
    }
    if (Array.isArray(toc) && toc.length > 0) {
      toc.forEach((t, idxOrder) => {
        const chapterId = typeof t.chapterId === 'string' ? (t.chapterId as string) : `chap-${idxOrder + 1}`
        const startChunk = typeof t.startChunk === 'number' ? (t.startChunk as number) : undefined
        const endChunk = typeof t.endChunk === 'number' ? (t.endChunk as number) : undefined
        const computedCount = typeof startChunk === 'number' && typeof endChunk === 'number' && endChunk >= startChunk
          ? (endChunk - startChunk + 1) : undefined
        pushChapter(chapterId, {
          chapterId,
          order: typeof t.order === 'number' ? (t.order as number) : idxOrder + 1,
          level: typeof t.level === 'number' ? (t.level as number) : undefined,
          title: typeof t.title === 'string' ? (t.title as string) : undefined,
          startChunk,
          endChunk,
          chunkCount: computedCount,
          startPage: typeof t.startPage === 'number' ? (t.startPage as number) : undefined,
          endPage: typeof t.endPage === 'number' ? (t.endPage as number) : undefined,
        })
      })
    } else if (docMetaObj && typeof (docMetaObj as { chapters?: unknown }).chapters !== 'undefined') {
      const chaptersRaw = (docMetaObj as { chapters?: unknown }).chapters
      if (Array.isArray(chaptersRaw)) {
        (chaptersRaw as Array<Record<string, unknown>>).forEach((c, idx) => {
          const chapterId = typeof c.chapterId === 'string' ? (c.chapterId as string) : `ord-${typeof c.order === 'number' ? (c.order as number) : (idx + 1)}`
          pushChapter(chapterId, {
            chapterId,
            order: typeof c.order === 'number' ? (c.order as number) : (idx + 1),
            level: typeof c.level === 'number' ? (c.level as number) : undefined,
            title: typeof c.title === 'string' ? (c.title as string) : undefined,
            startPage: typeof c.startPage === 'number' ? (c.startPage as number) : undefined,
            endPage: typeof c.endPage === 'number' ? (c.endPage as number) : undefined,
            summary: typeof c.summary === 'string' ? (c.summary as string) : undefined,
            keywords: Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(k => typeof k === 'string') as string[] : undefined,
          })
        })
      }
    }

    // Hinweis: Keine weiteren Pinecone-Reads nötig. Kapitel kommen vollständig aus docMetaJson/tocJson.

    const chapters: ChapterDto[] = Array.from(chaptersMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const payload: IngestionStatusDto = {
      indexExists: true,
      doc: {
        exists: true,
        status: isStale ? 'stale' : 'ok',
        fileName,
        title,
        user: userMeta,
        chunkCount,
        chaptersCount,
        upsertedAt,
        docModifiedAt: storedDocMod,
        authors,
        year,
        pages: typeof pagesNum === 'number' ? pagesNum : undefined,
        region: regionStr,
        docType: docTypeStr,
        source: sourceStr,
        issue: issueVal,
        language: languageStr,
        topics: topicsArr,
        summary: summaryStr,
      },
      chapters,
    }
    FileLogger.info('ingestion-status', 'Response', { libraryId, fileId, chapters: chapters.length, status: payload.doc.status })
    return NextResponse.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    FileLogger.error('ingestion-status', 'Fehler', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function safeParseJson(input: string): unknown {
  try { return JSON.parse(input) } catch { return undefined }
}

function normalizeStr(v: unknown): string | undefined {
  if (typeof v === 'string') return v.replace(/^\s*"|"\s*$/g, '').trim()
  return undefined
}

function normStrArr(v: unknown): string[] | undefined {
  if (!v) return undefined
  if (Array.isArray(v)) return v.map(x => normalizeStr(x) || '').filter(Boolean)
  if (typeof v === 'string') {
    // häufig kommen stringifizierte Arrays wie " [\"a\",\"b\"]"
    try {
      const parsed = JSON.parse(v) as unknown
      if (Array.isArray(parsed)) return parsed.map(x => normalizeStr(x) || '').filter(Boolean)
    } catch { /* ignore */ }
    return [normalizeStr(v) || ''].filter(Boolean)
  }
  return undefined
}

function normalizeMaybeNumber(v: unknown): number | string | undefined {
  if (typeof v === 'number') return v
  const s = normalizeStr(v)
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : s
}


