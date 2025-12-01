import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { aggregateFacets, getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'

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
    
    // PERFORMANCE: Index-Erstellung zur Laufzeit entfernen
    // await ensureFacetIndexes(libraryKey, defs)
    
    // Filter aus Query-Parametern extrahieren (konsistent mit /docs Route)
    const url = new URL(_req.url)
    const builtin = buildFilterFromQuery(url, defs)
    // buildFilterFromQuery liefert normalisierte Filter-Form; auf MongoDB-Form abbilden
    // Dynamisch alle Facetten-Filter hinzufügen (nicht nur hardcodierte Liste)
    const filter: Record<string, unknown> = {}
    for (const def of defs) {
      if (builtin[def.metaKey]) {
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


