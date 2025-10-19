import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, queryVectors, listVectors } from '@/lib/chat/pinecone'
import { parseFacetDefs, aggregateFacetCounts } from '@/lib/chat/dynamic-facets'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
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

    const defs = parseFacetDefs(ctx.library)
    const vectors = await listVectors(idx.host, apiKey, { libraryId: { $eq: libraryId }, kind: { $eq: 'doc' } }, 1000)
    const counts = aggregateFacetCounts(vectors, defs)
    const out = defs.map(d => ({ metaKey: d.metaKey, label: d.label || d.metaKey, type: d.type, options: counts[d.metaKey] || [] }))
    return NextResponse.json({ facets: out }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


