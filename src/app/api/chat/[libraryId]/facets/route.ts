import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { aggregateFacets, getCollectionNameForLibrary, ensureFacetIndexes } from '@/lib/repositories/doc-meta-repo'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
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

    const defs = parseFacetDefs(ctx.library)
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    
    // PERFORMANCE: Stelle sicher, dass Indizes für Facettenfelder vorhanden sind
    // Dies wird beim ersten Aufruf die Indizes erstellen, danach werden sie aus dem Cache geladen
    try {
      await ensureFacetIndexes(libraryKey, defs)
    } catch {
      // Fehler bei Index-Erstellung ignorieren (z.B. wenn bereits vorhanden)
    }
    
    // Filter aus Query-Parametern extrahieren (konsistent mit /docs Route)
    const url = new URL(_req.url)
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

    const counts = await aggregateFacets(libraryKey, libraryId, filter, defs.map(d => ({ metaKey: d.metaKey, type: d.type, label: d.label })))
    const out = defs.map(d => {
      const options = counts[d.metaKey] || []
      const sorted = (d.sort === 'count')
        ? options.slice().sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
        : options.slice().sort((a, b) => String(a.value).localeCompare(String(b.value)))
      const limited = typeof d.max === 'number' ? sorted.slice(0, d.max) : sorted
      return { metaKey: d.metaKey, label: d.label || d.metaKey, type: d.type, options: limited, columns: d.columns || 1 }
    })
    return NextResponse.json({ facets: out }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


