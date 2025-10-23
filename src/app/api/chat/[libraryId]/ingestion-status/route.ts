import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { FileLogger } from '@/lib/debug/logger'
import { computeDocMetaCollectionName, getByFileIds } from '@/lib/repositories/doc-meta-repo'

interface ChapterDto {
  chapterId: string
  title?: string
  order?: number
  level?: number
  startChunk?: number
  endChunk?: number
  chunkCount?: number
  startPage?: number
  endPage?: number
  pageCount?: number
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

    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const docModifiedAt = url.searchParams.get('docModifiedAt') || undefined
    if (!fileId) return NextResponse.json({ error: 'fileId erforderlich' }, { status: 400 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(userEmail, libraryId, strategy)

    const map = await getByFileIds(libraryKey, libraryId, [fileId])
    const docMeta = map.get(fileId)

    if (!docMeta) {
      const payload: IngestionStatusDto = {
        indexExists: true,
        doc: { exists: false, status: 'not_indexed' },
        chapters: [],
      }
      return NextResponse.json(payload)
    }

    const upsertedAt = typeof docMeta.upsertedAt === 'string' ? docMeta.upsertedAt : undefined
    const fileName = typeof docMeta.fileName === 'string' ? docMeta.fileName : undefined
    const userMeta = typeof docMeta.user === 'string' ? docMeta.user : undefined
    const chunkCount = typeof docMeta.chunkCount === 'number' ? docMeta.chunkCount : undefined
    const chaptersCount = typeof docMeta.chaptersCount === 'number' ? docMeta.chaptersCount : undefined

    const docMetaObj = (docMeta.docMetaJson && typeof docMeta.docMetaJson === 'object') ? docMeta.docMetaJson as Record<string, unknown> : undefined
    const storedDocMod = normalizeStr((docMetaObj as Record<string, unknown> | undefined)?.docModifiedAt)
    const isStale = !!(docModifiedAt && storedDocMod && new Date(storedDocMod).getTime() < new Date(docModifiedAt).getTime())

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

    // Kapitel bevorzugt aus docMetaJson.chapters; Fallback: docMeta.chapters
    let chapters: ChapterDto[] = []
    const chaptersJson = (docMetaObj && Array.isArray((docMetaObj as Record<string, unknown>).chapters))
      ? (docMetaObj as { chapters: Array<Record<string, unknown>> }).chapters
      : undefined

    if (Array.isArray(chaptersJson) && chaptersJson.length > 0) {
      chapters = chaptersJson.map((c, idx) => {
        const order = typeof c.order === 'number' ? c.order : (idx + 1)
        const level = typeof c.level === 'number' ? c.level : undefined
        const title = typeof c.title === 'string' ? c.title : undefined
        const startPageV = typeof c.startPage === 'number' ? c.startPage : undefined
        const endPageV = typeof c.endPage === 'number' ? c.endPage : undefined
        const pageCountV = typeof c.pageCount === 'number' ? c.pageCount : (typeof startPageV === 'number' && typeof endPageV === 'number' && endPageV >= startPageV ? (endPageV - startPageV + 1) : undefined)
        const summaryV = typeof c.summary === 'string' ? c.summary : undefined
        const keywordsV = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(k => typeof k === 'string') as string[] : undefined
        return {
          chapterId: `chap-${order}`,
          title,
          order,
          level,
          startPage: startPageV,
          endPage: endPageV,
          pageCount: pageCountV,
          summary: summaryV,
          keywords: keywordsV,
        }
      }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    } else {
      const chaptersIn = Array.isArray(docMeta.chapters) ? docMeta.chapters : []
      chapters = chaptersIn.map((c, idx) => ({
        chapterId: typeof c.id === 'string' ? c.id : `chap-${typeof c.index === 'number' ? c.index : (idx + 1)}`,
        title: typeof c.title === 'string' ? c.title : undefined,
        order: typeof c.index === 'number' ? c.index : (idx + 1),
        level: typeof c.level === 'number' ? c.level : undefined,
        startPage: typeof c.startPage === 'number' ? c.startPage : undefined,
        endPage: typeof c.endPage === 'number' ? c.endPage : undefined,
        pageCount: typeof c.pageCount === 'number' ? c.pageCount : undefined,
        chunkCount: typeof c.chunkCount === 'number' ? c.chunkCount : undefined,
        summary: typeof c.summary === 'string' ? c.summary : undefined,
        keywords: Array.isArray(c.keywords) ? c.keywords : undefined,
      })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

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


