import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { resolveFacetScope } from '@/lib/chat/facet-scope'
import { aggregateFacets, distinctViewTypes, getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { maybePublicationFilter } from '@/lib/chat/publication-filter'
import { isValidDetailViewType } from '@/lib/detail-view-types/registry'
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils'

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

    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const url = new URL(_req.url)

    // A4a — Typ als Leitfilter: optionaler `detailViewType`-Parameter scoped die
    // Facetten (gemeinsam ohne Wahl, typ-spezifisch mit Wahl) + filtert streng.
    const selectedTypeRaw = url.searchParams.get('detailViewType')
    const selectedType = selectedTypeRaw && selectedTypeRaw.trim() ? selectedTypeRaw.trim() : null
    if (selectedType && !isValidDetailViewType(selectedType)) {
      return NextResponse.json({ error: `Unbekannter detailViewType „${selectedType}".` }, { status: 400 })
    }
    const libraryDefaultType = getDetailViewType({}, ctx.library.config?.chat)
    // Immer die vorhandenen Typen ermitteln: dienen als Leitfilter-Optionen (UI)
    // UND als Basis fuer die gemeinsamen Facetten (ohne Typ-Wahl).
    const availableViewTypes = await distinctViewTypes(libraryKey, libraryId)
    const scope = resolveFacetScope({
      library: ctx.library,
      selectedType,
      presentTypes: selectedType ? [] : availableViewTypes,
      libraryDefaultType,
    })

    // Alle (gescopten) Definitionen: für buildFilterFromQuery (auch unsichtbare Facetten)
    const defs = scope.defs
    // Nur sichtbare Facetten: Sidebar/„Filter“-Navigation entspricht „Sichtbar“ in Story-Config
    const visibleDefs = defs.filter((d) => d.visible)

    // Filter aus Query-Parametern extrahieren (konsistent mit /docs Route)
    const builtin = buildFilterFromQuery(url, defs)
    // buildFilterFromQuery liefert normalisierte Filter-Form; auf MongoDB-Form abbilden
    // Dynamisch alle Facetten-Filter hinzufügen (nicht nur hardcodierte Liste)
    const filter: Record<string, unknown> = {}
    for (const def of defs) {
      if (builtin[def.metaKey]) {
        filter[def.metaKey] = builtin[def.metaKey]
      }
    }

    // A4a: strenger Typ-Filter (nur bei gewaehltem Typ). Per $and anhaengen,
    // damit ein eventuelles $or (Default-Typ-Einbezug) nichts ueberschreibt.
    if (scope.typeFilter) {
      const existing = Array.isArray(filter.$and) ? filter.$and : []
      filter.$and = [...existing, scope.typeFilter]
    }

    // Doc-Publication: Drafts werden bei nicht-Owner-Sichten aus den Facetten-
    // Counts ausgeschlossen, damit Filter-Zaehler konsistent zur Galerie-Liste sind.
    const pubFilter = await maybePublicationFilter(libraryId, userEmail || null)
    if (pubFilter) Object.assign(filter, pubFilter)

    const counts = await aggregateFacets(
      libraryKey,
      libraryId,
      filter,
      visibleDefs.map((d) => ({ metaKey: d.metaKey, type: d.type, label: d.label }))
    )
    const out = visibleDefs.map((d) => {
      const options = counts[d.metaKey] || []
      const sorted = (d.sort === 'count')
        ? options.slice().sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
        : options.slice().sort((a, b) => String(a.value).localeCompare(String(b.value)))
      const limited = typeof d.max === 'number' ? sorted.slice(0, d.max) : sorted
      return { metaKey: d.metaKey, label: d.label || d.metaKey, type: d.type, options: limited, columns: d.columns || 1 }
    })
    // A4a: vorhandene Typen + aktuelle Wahl mitliefern (UI-Leitfilter).
    return NextResponse.json(
      { facets: out, viewTypes: availableViewTypes, selectedViewType: scope.selectedType },
      { status: 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


