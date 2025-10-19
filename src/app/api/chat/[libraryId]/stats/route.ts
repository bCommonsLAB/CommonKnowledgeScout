import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { describeIndex, queryVectors, listVectors } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { accumulateVectorStats } from '@/lib/chat/vector-stats'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ ok: true, indexExists: false, totals: { docs: 0, chunks: 0 } })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ ok: true, indexExists: false, totals: { docs: 0, chunks: 0 } })

    // Scope bestimmen: library (Default), user, all
    const urlObj = new URL(_request.url)
    const scopeParam = urlObj.searchParams.get('scope')
    const debugParam = urlObj.searchParams.get('debug')
    const scope: 'library' | 'user' | 'all' = scopeParam === 'user' ? 'user' : scopeParam === 'all' ? 'all' : 'library'
    const filter = scope === 'user'
      ? { libraryId: { $eq: libraryId }, user: { $eq: userEmail } }
      : scope === 'library'
        ? { libraryId: { $eq: libraryId } }
        : undefined
    const wantDebug = debugParam === '1' || debugParam === 'true'

    // Primäre Strategie: Query mit Null-Vektor und großem topK für exakte Zählungen pro kind
    try {
      // Facetten identisch zur Galerie berücksichtigen
      const author = urlObj.searchParams.getAll('author')
      const region = urlObj.searchParams.getAll('region')
      const year = urlObj.searchParams.getAll('year')
      const docType = urlObj.searchParams.getAll('docType')
      const source = urlObj.searchParams.getAll('source')
      const tag = urlObj.searchParams.getAll('tag')

      const baseFilter: Record<string, unknown> = (filter && typeof filter === 'object') ? { ...(filter as Record<string, unknown>) } : {}
      if (author.length > 0) baseFilter['authors'] = { $in: author }
      if (region.length > 0) baseFilter['region'] = { $in: region }
      if (year.length > 0) baseFilter['year'] = { $in: year.map(y => (isNaN(Number(y)) ? y : Number(y))) }
      if (docType.length > 0) baseFilter['docType'] = { $in: docType }
      if (source.length > 0) baseFilter['source'] = { $in: source }
      if (tag.length > 0) baseFilter['tags'] = { $in: tag }

      const dim = typeof (idx as unknown as { dimension?: unknown }).dimension === 'number'
        ? Number((idx as unknown as { dimension: number }).dimension)
        : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)
      const zero = new Array<number>(dim).fill(0)

      const topKDocs = 5000
      const topKChapters = 10000
      const topKChunks = 15000

      const [docMatches, chapterMatches, chunkMatches] = await Promise.all([
        queryVectors(idx.host, apiKey, zero, topKDocs, { ...baseFilter, kind: { $eq: 'doc' } }),
        queryVectors(idx.host, apiKey, zero, topKChapters, { ...baseFilter, kind: { $eq: 'chapterSummary' } }),
        queryVectors(idx.host, apiKey, zero, topKChunks, { ...baseFilter, kind: { $eq: 'chunk' } }),
      ])

      const docIds = new Set(
        docMatches
          .map(m => (m.metadata && typeof m.metadata === 'object' ? (m.metadata as { fileId?: unknown }).fileId : undefined))
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )

      const breakdown = {
        doc: docMatches.length,
        chapterSummary: chapterMatches.length,
        chunk: chunkMatches.length,
        uniqueDocs: docIds.size,
      }

      let diag: Record<string, unknown> | undefined
      if (wantDebug) {
        let match = 0, missing = 0, other = 0
        for (const m of docMatches) {
          const lid = (m.metadata as { libraryId?: unknown } | undefined)?.libraryId
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
        info: { indexName: ctx.vectorIndex, indexHost: idx.host, scope },
        totals: { docs: breakdown.uniqueDocs, chunks: breakdown.chunk },
        breakdown,
        ...(diag ? { diag } : {}),
      })
    } catch {
      // Fallback: listVectors (ohne Facettenpräzision)
      const vectors = await listVectors(idx.host, apiKey, filter, 1000)
      const breakdown = accumulateVectorStats(vectors.map(v => ({ id: v.id, metadata: v.metadata })))
      return NextResponse.json({
        ok: true,
        indexExists: true,
        info: { indexName: ctx.vectorIndex, indexHost: idx.host, scope },
        totals: { docs: breakdown.uniqueDocs, chunks: breakdown.chunk },
        breakdown,
      })
    }
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


