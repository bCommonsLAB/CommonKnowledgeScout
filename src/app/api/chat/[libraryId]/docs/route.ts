import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { findDocs, getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import type { Document } from 'mongodb'

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
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    
    // PERFORMANCE: Index-Erstellung zur Laufzeit entfernen
    // await ensureFacetIndexes(libraryKey, defs)
    const builtin = buildFilterFromQuery(url, defs)
    // buildFilterFromQuery liefert normalisierte Filter-Form; auf MongoDB-Form abbilden
    // Verwende Utility-Funktion für shortTitle-Mapping zu docMetaJson.shortTitle
    const filter = facetsSelectedToMongoFilter(builtin)
    
    // Unterstütze auch dynamische Facettenfelder (z.B. event, track, speakers aus Session-Daten)
    // Die Utility-Funktion behandelt bereits alle Facetten, aber wir stellen sicher,
    // dass alle Facetten aus builtin enthalten sind (falls sie nicht bereits durch facetsSelectedToMongoFilter behandelt wurden)
    for (const def of defs) {
      if (builtin[def.metaKey] && !filter[def.metaKey]) {
        // Konvertiere zu MongoDB-Format falls nötig
        const value = builtin[def.metaKey]
        if (Array.isArray(value)) {
          filter[def.metaKey] = { $in: value }
        } else {
          filter[def.metaKey] = value
        }
      }
    }

    // Prüfe, ob Image-URLs mitgeladen werden sollen (für Kompatibilität)
    const includeImageUrls = url.searchParams.get('includeImageUrls') === 'true'
    
    // Pagination params
    const limitParam = url.searchParams.get('limit')
    const skipParam = url.searchParams.get('skip')
    const limit = limitParam ? parseInt(limitParam, 10) : 50 // Default auf 50 für bessere Performance
    const skip = skipParam ? parseInt(skipParam, 10) : 0

    // Search param - Dynamisch in allen String/String[] Facetten suchen
    const search = url.searchParams.get('search')
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' }
      const searchFields: Array<Record<string, unknown>> = [
        { title: searchRegex },
        { shortTitle: searchRegex },
        { 'docMetaJson.title': searchRegex }, // Auch in docMetaJson suchen
        { 'docMetaJson.shortTitle': searchRegex }
      ]
      
      // Füge alle String/String[] Facetten dynamisch zur Suche hinzu
      for (const def of defs) {
        if (def.type === 'string' || def.type === 'string[]') {
          searchFields.push({ [def.metaKey]: searchRegex })
          searchFields.push({ [`docMetaJson.${def.metaKey}`]: searchRegex })
        }
      }
      
      filter.$or = searchFields
    }

    const result = await findDocs(libraryKey, libraryId, filter, { limit, skip, sort: { year: -1, upsertedAt: -1 } })
    
    // Wenn includeImageUrls=true, lade Image-URLs für alle Dokumente
    // Ansonsten werden sie lazy-loaded über die separate Route
    if (includeImageUrls) {
      const col = await getCollectionOnly(libraryKey)
      const itemsWithImages = await Promise.all(
        result.items.map(async (item) => {
          if (!item.fileId) return item
          
          const doc = await col.findOne(
            { _id: `${item.fileId}-meta`, kind: 'meta' } as Partial<Document>,
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
      
      return NextResponse.json({ items: itemsWithImages, total: result.total }, { status: 200 })
    }
    
    return NextResponse.json({ items: result.items, total: result.total }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


