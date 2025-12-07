import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'

/**
 * GET /api/chat/[libraryId]/docs/ids
 * Gibt alle gefilterten Dokument-fileIds zurück (ohne Pagination)
 * 
 * Nutzt gleiche Filter-Logik wie /docs Endpunkt
 * Filtert nur nach kind: 'meta' Dokumenten und extrahiert fileId Werte
 * Gibt Array von eindeutigen fileIds zurück für Bulk-Delete
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    
    // Rate-Limiting-Schutz: Versuche auth() und currentUser() mit Fehlerbehandlung
    let userId: string | null = null
    let userEmail = ''
    
    try {
      const authResult = await auth()
      userId = authResult.userId || null
      
      if (userId) {
        const user = await currentUser()
        userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      }
    } catch (authError) {
      // Rate Limit Error: Loggen aber nicht abbrechen (für öffentliche Libraries)
      const isRateLimit = authError && typeof authError === 'object' && 'status' in authError && authError.status === 429
      if (isRateLimit) {
        console.warn('[API] Clerk Rate Limit beim Laden der Dokument-IDs, versuche ohne Auth fortzufahren')
        // Für öffentliche Libraries können wir ohne Auth fortfahren
      } else {
        // Andere Auth-Fehler: Weiterwerfen
        throw authError
      }
    }

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
    
    const builtin = buildFilterFromQuery(url, defs)
    const filter = facetsSelectedToMongoFilter(builtin)
    
    // Unterstütze auch dynamische Facettenfelder
    for (const def of defs) {
      if (builtin[def.metaKey] && !filter[def.metaKey]) {
        const value = builtin[def.metaKey]
        if (Array.isArray(value)) {
          filter[def.metaKey] = { $in: value }
        } else {
          filter[def.metaKey] = value
        }
      }
    }

    // Search param - Dynamisch in allen String/String[] Facetten suchen
    const search = url.searchParams.get('search')
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' }
      const searchFields: Array<Record<string, unknown>> = [
        { title: searchRegex },
        { shortTitle: searchRegex },
        { 'docMetaJson.title': searchRegex },
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

    // WICHTIG: Filter nur nach kind: 'meta' Dokumenten
    filter.kind = 'meta'

    // Hole alle Meta-Dokumente (ohne Pagination)
    const col = await getCollectionOnly(libraryKey)
    const metaDocs = await col.find(filter).toArray()

    // Extrahiere eindeutige fileIds
    const fileIds = Array.from(new Set(
      metaDocs
        .map(doc => doc.fileId)
        .filter((fileId): fileId is string => typeof fileId === 'string' && fileId.length > 0)
    ))

    return NextResponse.json({ fileIds, count: fileIds.length }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

