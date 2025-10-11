import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, queryVectors } from '@/lib/chat/pinecone'

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const { libraryId } = await params
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })
    const dim = typeof idx.dimension === 'number' ? idx.dimension : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)

    // Dummy-Vektor, aber Filter selektiert nur Meta-Vektoren (kind: 'doc') dieser Library
    const vector = Array(dim).fill(0)
    // Query-Params für Facettenfilter
    const url = new URL(req.url)
    // Mehrfachwerte erlauben (author=...&author=...)
    const author = url.searchParams.getAll('author')
    const region = url.searchParams.getAll('region')
    const year = url.searchParams.getAll('year')
    const docType = url.searchParams.getAll('docType')
    const source = url.searchParams.getAll('source')
    const tag = url.searchParams.getAll('tag')

    const filter: Record<string, unknown> = { libraryId: { $eq: libraryId }, kind: { $eq: 'doc' } }
    if (author.length > 0) filter['authors'] = { $in: author }
    if (region.length > 0) filter['region'] = { $in: region }
    if (year.length > 0) filter['year'] = { $in: year.map(y => (isNaN(Number(y)) ? y : Number(y))) }
    if (docType.length > 0) filter['docType'] = { $in: docType }
    if (source.length > 0) filter['source'] = { $in: source }
    if (tag.length > 0) filter['tags'] = { $in: tag }
    try {
      const matches = await queryVectors(idx.host, apiKey, vector, 200, filter)
      const items = matches.map(m => {
        const md = (m.metadata || {}) as Record<string, unknown>
        let docMeta: Record<string, unknown> = {}
        if (typeof md.docMetaJson === 'string') {
          try { docMeta = JSON.parse(md.docMetaJson) as Record<string, unknown> } catch {}
        }
        return {
          id: m.id,
          fileId: typeof md.fileId === 'string' ? md.fileId : undefined,
          fileName: typeof md.fileName === 'string' ? md.fileName : undefined,
          title: typeof docMeta.title === 'string' ? docMeta.title : undefined,
          shortTitle: typeof docMeta.shortTitle === 'string' ? docMeta.shortTitle : undefined,
          authors: Array.isArray(md.authors) ? (md.authors as Array<unknown>).filter(a => typeof a === 'string') as string[]
            : Array.isArray(docMeta.authors) ? (docMeta.authors as Array<unknown>).filter(a => typeof a === 'string') as string[] : undefined,
          year: typeof md.year === 'number' || typeof md.year === 'string' ? md.year
            : typeof docMeta.year === 'number' || typeof docMeta.year === 'string' ? docMeta.year : undefined,
          region: typeof (docMeta as { region?: unknown })?.region === 'string' ? (docMeta as { region: string }).region : undefined,
          upsertedAt: typeof md.upsertedAt === 'string' ? md.upsertedAt : undefined,
          docType: typeof (docMeta as { docType?: unknown })?.docType === 'string' ? (docMeta as { docType: string }).docType : (typeof md.docType === 'string' ? md.docType : undefined),
          source: typeof (docMeta as { source?: unknown })?.source === 'string' ? (docMeta as { source: string }).source : (typeof md.source === 'string' ? md.source : undefined),
          tags: Array.isArray(md.tags) ? (md.tags as Array<unknown>).filter(t => typeof t === 'string') as string[] : undefined,
          // Statusfelder für UI (Tooltip)
          extract_status: typeof md.extract_status === 'string' ? md.extract_status : undefined,
          template_status: typeof md.template_status === 'string' ? md.template_status : undefined,
          ingest_status: typeof md.ingest_status === 'string' ? md.ingest_status : undefined,
          process_status: typeof md.process_status === 'string' ? md.process_status : undefined,
          hasError: typeof md.hasError === 'boolean' ? md.hasError : undefined,
          errorCode: typeof md.errorCode === 'string' ? md.errorCode : undefined,
          errorMessage: typeof md.errorMessage === 'string' ? md.errorMessage : undefined,
        }
      })
      return NextResponse.json({ items }, { status: 200 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Query fehlgeschlagen'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


