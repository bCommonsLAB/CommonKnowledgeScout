import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { findDocs, computeDocMetaCollectionName, ensureFacetIndexes, getDocMetaCollection } from '@/lib/repositories/doc-meta-repo'

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { userId } = await auth()
    const { libraryId } = await params
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    // Chat-Kontext laden (nutzt userEmail für nicht-öffentliche Bibliotheken)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const url = new URL(req.url)
    const defs = parseFacetDefs(ctx.library)
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(userEmail, libraryId, strategy)
    
    // PERFORMANCE: Stelle sicher, dass Indizes für Facettenfelder vorhanden sind
    // Dies wird beim ersten Aufruf die Indizes erstellen, danach werden sie aus dem Cache geladen
    try {
      await ensureFacetIndexes(libraryKey, defs)
    } catch {
      // Fehler bei Index-Erstellung ignorieren (z.B. wenn bereits vorhanden)
    }
    const builtin = buildFilterFromQuery(url, defs)
    // buildFilterFromQuery liefert Pinecone-Filter-Form; auf Mongo-Form abbilden
    const filter: Record<string, unknown> = {}
    if (builtin['authors']) filter['authors'] = builtin['authors']
    if (builtin['region']) filter['region'] = builtin['region']
    if (builtin['year']) filter['year'] = builtin['year']
    if (builtin['docType']) filter['docType'] = builtin['docType']
    if (builtin['source']) filter['source'] = builtin['source']
    if (builtin['tags']) filter['tags'] = builtin['tags']
    // Unterstütze auch dynamische Facettenfelder (z.B. event, track, speakers aus Session-Daten)
    for (const def of defs) {
      if (builtin[def.metaKey] && !filter[def.metaKey]) {
        filter[def.metaKey] = builtin[def.metaKey]
      }
    }

    // Prüfe, ob Image-URLs mitgeladen werden sollen (für Kompatibilität)
    const includeImageUrls = url.searchParams.get('includeImageUrls') === 'true'
    
    const items = await findDocs(libraryKey, libraryId, filter, { limit: 400, sort: { year: -1, upsertedAt: -1 } })
    
    // Wenn includeImageUrls=true, lade Image-URLs für alle Dokumente
    // Ansonsten werden sie lazy-loaded über die separate Route
    if (includeImageUrls) {
      const col = await getDocMetaCollection(libraryKey)
      const itemsWithImages = await Promise.all(
        items.map(async (item) => {
          if (!item.fileId) return item
          
          const doc = await col.findOne(
            { fileId: item.fileId },
            {
              projection: {
                _id: 0,
                speakers_image_url: 1,
                'docMetaJson.speakers_image_url': 1,
              }
            }
          )
          
          if (!doc) return item
          
          const toStrArr = (val: unknown): string[] | undefined => {
            if (Array.isArray(val)) {
              return val.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            }
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val)
                return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : undefined
              } catch {
                return undefined
              }
            }
            return undefined
          }
          
          const docMeta = doc.docMetaJson && typeof doc.docMetaJson === 'object' 
            ? doc.docMetaJson as Record<string, unknown> 
            : undefined
          
          const speakersImageUrlTopLevel = toStrArr(doc.speakers_image_url)
          const speakersImageUrlDocMeta = docMeta ? toStrArr(docMeta.speakers_image_url) : undefined
          const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta || []
          
          return { ...item, speakers_image_url: speakersImageUrl.length > 0 ? speakersImageUrl : undefined }
        })
      )
      
      return NextResponse.json({ items: itemsWithImages }, { status: 200 })
    }
    
    return NextResponse.json({ items }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


