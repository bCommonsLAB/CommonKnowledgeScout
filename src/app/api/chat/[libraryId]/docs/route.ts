import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { findDocs, computeDocMetaCollectionName } from '@/lib/repositories/doc-meta-repo'

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

    const url = new URL(req.url)
    const defs = parseFacetDefs(ctx.library)
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(userEmail, libraryId, strategy)
    const builtin = buildFilterFromQuery(url, defs)
    // buildFilterFromQuery liefert Pinecone-Filter-Form; auf Mongo-Form abbilden
    const filter: Record<string, unknown> = { }
    if (builtin['authors']) filter['authors'] = builtin['authors']
    if (builtin['region']) filter['region'] = builtin['region']
    if (builtin['year']) filter['year'] = builtin['year']
    if (builtin['docType']) filter['docType'] = builtin['docType']
    if (builtin['source']) filter['source'] = builtin['source']
    if (builtin['tags']) filter['tags'] = builtin['tags']

    const items = await findDocs(libraryKey, libraryId, filter, { limit: 200, sort: { upsertedAt: -1 } })
    return NextResponse.json({ items }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


