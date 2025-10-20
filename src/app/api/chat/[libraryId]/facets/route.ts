import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { aggregateFacets, computeDocMetaCollectionName } from '@/lib/repositories/doc-meta-repo'

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

    const defs = parseFacetDefs(ctx.library)
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(userEmail, libraryId, strategy)
    // Optional: Filter aus Query (gleiches Schema wie bisher)
    const url = new URL(_req.url)
    const filter: Record<string, unknown> = { libraryId }
    const author = url.searchParams.getAll('author')
    const region = url.searchParams.getAll('region')
    const year = url.searchParams.getAll('year')
    const docType = url.searchParams.getAll('docType')
    const source = url.searchParams.getAll('source')
    const tag = url.searchParams.getAll('tag')
    if (author.length > 0) filter['authors'] = { $in: author }
    if (region.length > 0) filter['region'] = { $in: region }
    if (year.length > 0) filter['year'] = { $in: year.map(y => (isNaN(Number(y)) ? y : Number(y))) }
    if (docType.length > 0) filter['docType'] = { $in: docType }
    if (source.length > 0) filter['source'] = { $in: source }
    if (tag.length > 0) filter['tags'] = { $in: tag }

    const counts = await aggregateFacets(libraryKey, libraryId, filter, defs.map(d => ({ metaKey: d.metaKey, type: d.type, label: d.label })))
    const out = defs.map(d => ({ metaKey: d.metaKey, label: d.label || d.metaKey, type: d.type, options: counts[d.metaKey] || [] }))
    return NextResponse.json({ facets: out }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


