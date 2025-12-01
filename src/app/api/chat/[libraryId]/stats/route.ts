import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    // Für öffentliche Libraries: Erlaube Zugriff ohne Auth
    // Prüfe zuerst, ob Library öffentlich ist
    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Wenn nicht öffentlich und nicht authentifiziert: Fehler
    if (!ctx.library.config?.publicPublishing?.isPublic && (!userId || !userEmail)) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const col = await getCollectionOnly(libraryKey)

    // Scope bestimmen: library (Default), user, all
    const urlObj = new URL(_request.url)
    const scopeParam = urlObj.searchParams.get('scope')
    const debugParam = urlObj.searchParams.get('debug')
    const scope: 'library' | 'user' | 'all' = scopeParam === 'user' ? 'user' : scopeParam === 'all' ? 'all' : 'library'
    const wantDebug = debugParam === '1' || debugParam === 'true'

    // Basis-Filter für Scope
    const baseFilter: Record<string, unknown> = {}
    if (scope === 'user') {
      baseFilter.libraryId = libraryId
      baseFilter.user = userEmail
    } else if (scope === 'library') {
      baseFilter.libraryId = libraryId
    }

    // Dynamisch Facetten-Filter aus Query-Parametern extrahieren
    const defs = parseFacetDefs(ctx.library)
    const builtin = buildFilterFromQuery(urlObj, defs)
    // buildFilterFromQuery liefert bereits MongoDB-Format ({ $in: [...] })
    // Füge alle Facetten-Filter dynamisch hinzu
    for (const def of defs) {
      if (builtin[def.metaKey]) {
        baseFilter[def.metaKey] = builtin[def.metaKey]
      }
    }

    // Zähle direkt aus MongoDB
    const [metaCount, chapterCount, chunkCount] = await Promise.all([
      col.countDocuments({ ...baseFilter, kind: 'meta' }),
      col.countDocuments({ ...baseFilter, kind: 'chapterSummary' }),
      col.countDocuments({ ...baseFilter, kind: 'chunk' }),
    ])

    // Eindeutige Dokumente zählen (aus Meta-Dokumenten)
    const uniqueDocs = await col.distinct('fileId', { ...baseFilter, kind: 'meta' })

    const breakdown = {
      doc: metaCount,
      chapterSummary: chapterCount,
      chunk: chunkCount,
      uniqueDocs: uniqueDocs.length,
    }

    let diag: Record<string, unknown> | undefined
    if (wantDebug) {
      // Debug-Info: Prüfe libraryId-Konsistenz
      const metaDocs = await col.find({ ...baseFilter, kind: 'meta' }, { projection: { libraryId: 1 } }).limit(100).toArray()
      let match = 0, missing = 0, other = 0
      for (const doc of metaDocs) {
        const lid = doc.libraryId
        if (typeof lid === 'string') {
          if (lid === libraryId) match += 1
          else other += 1
        } else missing += 1
      }
      diag = { docLibraryMatch: match, docMissingLibraryId: missing, docOtherLibraryId: other }
    }

    return NextResponse.json({
      ok: true,
      indexExists: true,
      info: { collectionName: libraryKey, scope },
      totals: { docs: breakdown.uniqueDocs, chunks: breakdown.chunk },
      breakdown,
      ...(diag ? { diag } : {}),
    })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


