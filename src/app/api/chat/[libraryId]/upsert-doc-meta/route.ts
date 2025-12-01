import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { FileLogger } from '@/lib/debug/logger'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, upsertVectorMeta, getMetaByFileId } from '@/lib/repositories/vector-repo'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'

const bodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  docModifiedAt: z.string().optional(),
  // Freies Frontmatter (beliebiges Schema) – wird als JSON-String gespeichert
  docMeta: z.record(z.unknown()).optional(),
  // Flache Statusfelder – alle optional, werden 1:1 (primitive) gespeichert
  extract_status: z.string().optional(),
  template_status: z.string().optional(),
  ingest_status: z.string().optional(),
  process_status: z.string().optional(),
  hasError: z.boolean().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  lastErrorAt: z.string().optional(),
  // Optionale Facetten (primitiv)
  year: z.union([z.string(), z.number()]).optional(),
  language: z.string().optional(),
  region: z.string().optional(),
  docType: z.string().optional(),
  source: z.string().optional(),
  isScan: z.boolean().optional(),
  pageCount: z.union([z.string(), z.number()]).optional(),
  authors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

function truncate(str: string, max = 512): string {
  return str.length > max ? `${str.slice(0, max)}…` : str
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    FileLogger.info('upsert-doc-meta', 'Request erhalten')
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const libraryKey = getCollectionNameForLibrary(ctx.library)

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    }

    const {
      fileId,
      fileName,
      docModifiedAt,
      docMeta,
      extract_status,
      template_status,
      ingest_status,
      process_status,
      hasError,
      errorCode,
      errorMessage,
      lastErrorAt,
      year,
      language,
      region,
      docType,
      source,
      isScan,
      pageCount,
      authors,
      tags,
    } = parsed.data

    // Bestehende Metadaten holen (für Merge)
    let existingMeta: Record<string, unknown> | undefined
    try {
      const existing = await getMetaByFileId(libraryKey, fileId)
      if (existing) {
        existingMeta = existing as unknown as Record<string, unknown>
      }
    } catch {
      existingMeta = undefined
    }

    // Nur primitive Felder und string[] zulassen
    const flat: Record<string, unknown> = {}
    if (extract_status) flat.extract_status = extract_status
    if (template_status) flat.template_status = template_status
    if (ingest_status) flat.ingest_status = ingest_status
    if (process_status) flat.process_status = process_status
    if (typeof hasError === 'boolean') flat.hasError = hasError
    if (errorCode) flat.errorCode = errorCode
    if (errorMessage) flat.errorMessage = truncate(errorMessage, 512)
    if (lastErrorAt) flat.lastErrorAt = lastErrorAt
    if (year !== undefined) flat.year = typeof year === 'string' ? year : Number(year)
    if (language) flat.language = language
    if (region) flat.region = region
    if (docType) flat.docType = docType
    if (source) flat.source = source
    if (typeof isScan === 'boolean') flat.isScan = isScan
    if (pageCount !== undefined) flat.pageCount = typeof pageCount === 'string' ? pageCount : Number(pageCount)
    if (Array.isArray(authors)) flat.authors = authors.filter(a => typeof a === 'string')
    if (Array.isArray(tags)) flat.tags = tags.filter(t => typeof t === 'string')

    const metadata: Record<string, unknown> = {
      libraryId,
      user: userEmail,
      fileId,
      fileName,
      upsertedAt: new Date().toISOString(),
      ...(docModifiedAt ? { docModifiedAt } : {}),
      ...(docMeta ? { docMetaJson: docMeta } : {}),
      ...flat,
    }

    // Facetten-Promotion basierend auf Config-Defs
    try {
      const { parseFacetDefs, getTopLevelValue } = await import('@/lib/chat/dynamic-facets')
      const defs = parseFacetDefs(ctx.library)
      const src = (docMeta || {}) as Record<string, unknown>
      for (const d of defs) {
        const val = getTopLevelValue(src, d)
        if (val !== undefined) (metadata as Record<string, unknown>)[d.metaKey] = val
      }
    } catch {}

    // Merge: existing → new (neue Felder überschreiben alte), aber upsertedAt/docMetaJson immer aus neuem
    const merged = { 
      ...(existingMeta || {}), 
      ...metadata,
      // upsertedAt und docMetaJson immer aus neuem Request
      upsertedAt: metadata.upsertedAt,
      ...(docMeta ? { docMetaJson: docMeta } : {}),
    }

    FileLogger.info('upsert-doc-meta', 'Upsert vorbereitet', {
      libraryId,
      fileId,
      hasExisting: !!existingMeta,
      keys: Object.keys(merged).length
    })

    // Dimension aus Config holen
    const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)
    
    // Upsert Meta-Dokument in MongoDB
    await upsertVectorMeta(libraryKey, merged as typeof merged & { fileId: string }, dimension, ctx.library)
    FileLogger.info('upsert-doc-meta', 'Upsert erfolgreich', { fileId, collection: libraryKey })
    return NextResponse.json({ status: 'ok', fileId, collection: libraryKey })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    FileLogger.error('upsert-doc-meta', 'Fehler beim Upsert', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


