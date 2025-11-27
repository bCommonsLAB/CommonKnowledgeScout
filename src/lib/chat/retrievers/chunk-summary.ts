/**
 * @fileoverview Chunk Summary Retriever - Alle Chunks ohne Embedding-Suche
 * 
 * @description
 * Lädt alle Chunks der gefilterten Dokumente aus Pinecone OHNE Embedding-Suche.
 * Verwendet direkte Metadaten-Filter basierend auf MongoDB-Ergebnissen.
 * Ideal für überschaubare Dokumentmengen, die in das Token-Budget passen.
 * 
 * @module chat
 * 
 * @exports
 * - chunkSummaryRetriever: ChunkSummary-basierter Retriever ohne Embedding-Suche
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Orchestrator verwendet Retriever für chunkSummary-Modus
 * - src/app/api/chat/[libraryId]/stream/route.ts: Chat-Endpoint verwendet Retriever
 * 
 * @dependencies
 * - @/lib/chat/pinecone: Pinecone Vector-Operationen
 * - @/lib/chat/common/budget: Budget-Verwaltung
 * - @/lib/logging/query-logger: Query-Logging
 * - @/lib/chat/retrievers/metadata-extractor: Metadaten-Extraktion
 * - @/lib/repositories/doc-meta-repo: MongoDB Repository für Dokument-Metadaten
 */

import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { queryPineconeByFileIds, type QueryMatch } from '@/lib/chat/pinecone'
import { getBaseBudget } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend } from '@/lib/logging/query-logger'
import { extractFacetMetadata } from './metadata-extractor'
import { getCollectionNameForLibrary, findDocs } from '@/lib/repositories/doc-meta-repo'

const env = {
  maxDocs: Number(process.env.CHUNK_SUMMARY_MAX_DOCS ?? 100),
}

export const chunkSummaryRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // Library-Context laden, um Facetten-Definitionen zu erhalten
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const ctx = await loadLibraryChatContext(input.userEmail || '', input.libraryId)
    const { parseFacetDefs } = await import('@/lib/chat/dynamic-facets')
    const facetDefs = ctx ? parseFacetDefs(ctx.library) : []

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')

    const budget = getBaseBudget(input.answerLength)

    // Schritt 1: Gefilterte Dokumente aus MongoDB abrufen (nur fileIds)
    if (!ctx) {
      throw new Error('Library context nicht gefunden')
    }
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    
    let stepList = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'list', level: 'chunkSummary' })
    
    const docs = await findDocs(libraryKey, input.libraryId, input.filters || {}, {
      limit: env.maxDocs,
      sort: { upsertedAt: -1 },
    })
    
    const fileIds = docs.map(d => d.fileId).filter((id): id is string => typeof id === 'string' && id.length > 0)
    
    if (fileIds.length === 0) {
      stepList = markStepEnd({ ...stepList, topKReturned: 0 })
      await logAppend(input.queryId, {
        indexName: input.context.vectorIndex,
        namespace: '',
        stage: 'list',
        level: 'chunkSummary',
        timingMs: stepList.timingMs,
        startedAt: stepList.startedAt,
        endedAt: stepList.endedAt,
        candidatesCount: 0,
        usedInPrompt: 0,
        filtersEffective: {
          normalized: input.filters || {},
          pinecone: input.filters || {},
        },
      })
      return { sources: [], timing: { retrievalMs: Date.now() - t0 }, stats: { candidatesCount: 0, usedInPrompt: 0 } }
    }

    stepList = markStepEnd({ ...stepList, topKReturned: fileIds.length })
    await logAppend(input.queryId, {
      indexName: input.context.vectorIndex,
      namespace: '',
      stage: 'list',
      level: 'chunkSummary',
      timingMs: stepList.timingMs,
      startedAt: stepList.startedAt,
      endedAt: stepList.endedAt,
      candidatesCount: fileIds.length,
      usedInPrompt: fileIds.length,
      filtersEffective: {
        normalized: input.filters || {},
        pinecone: input.filters || {},
      },
    })

    // Schritt 2: Alle Chunks dieser Dokumente aus Pinecone abrufen (OHNE Embedding-Suche)
    // Verwende zentrale Funktion mit Null-Vektor
    let stepQuery = markStepStart({ 
      indexName: input.context.vectorIndex, 
      namespace: '', 
      stage: 'query', 
      level: 'chunkSummary',
      filtersEffective: { normalized: input.filters || {}, pinecone: { fileId: { $in: fileIds } } },
      queryVectorInfo: { source: 'question' }, // Verwende 'question' als Source (auch wenn Null-Vektor)
    })
    
    // Zentrale Funktion mit Null-Vektor (undefined = Null-Vektor wird automatisch erstellt)
    const matches = await queryPineconeByFileIds(
      input.context.vectorIndex,
      apiKey,
      fileIds,
      undefined, // Null-Vektor für alle Chunks ohne semantische Suche
      10000, // Maximal 10000 Chunks
      input.libraryId,
      input.userEmail || '',
      'chunk'
    )
    
    // Konvertiere QueryMatch[] zu Array<{ id: string; metadata?: Record<string, unknown> }>
    const allChunks = matches.map((m: QueryMatch) => ({ id: m.id, metadata: m.metadata }))
    
    stepQuery = markStepEnd({ ...stepQuery, topKReturned: allChunks.length })
    await logAppend(input.queryId, {
      indexName: input.context.vectorIndex,
      namespace: '',
      stage: 'query',
      level: 'chunkSummary',
      topKRequested: allChunks.length,
      topKReturned: allChunks.length,
      filtersEffective: { normalized: input.filters || {}, pinecone: { fileId: { $in: fileIds } } },
      timingMs: stepQuery.timingMs,
      startedAt: stepQuery.startedAt,
      endedAt: stepQuery.endedAt,
    })

    // Schritt 3: Chunks nach Budget filtern und sortieren
    const sources: RetrievedSource[] = []
    let used = 0
    
    // Sortiere Chunks nach fileId und chunkIndex für konsistente Reihenfolge
    const sortedChunks = allChunks.sort((a: { id: string; metadata?: Record<string, unknown> }, b: { id: string; metadata?: Record<string, unknown> }) => {
      const aFileId = a.metadata?.fileId as string | undefined
      const bFileId = b.metadata?.fileId as string | undefined
      const aChunkIndex = typeof a.metadata?.chunkIndex === 'number' ? a.metadata.chunkIndex : 0
      const bChunkIndex = typeof b.metadata?.chunkIndex === 'number' ? b.metadata.chunkIndex : 0
      
      if (aFileId !== bFileId) {
        return (aFileId || '').localeCompare(bFileId || '')
      }
      return aChunkIndex - bChunkIndex
    })

    for (const chunk of sortedChunks) {
      const meta = chunk.metadata
      if (!meta) continue
      
      const text = typeof meta.text === 'string' ? meta.text : ''
      if (!text) continue
      
      const fileName = typeof meta.fileName === 'string' ? meta.fileName : undefined
      const chunkIndex = typeof meta.chunkIndex === 'number' ? meta.chunkIndex : undefined
      const fileId = typeof meta.fileId === 'string' ? meta.fileId : undefined
      
      // Extrahiere sourceType und zusätzliche Metadaten
      const sourceType = typeof meta.sourceType === 'string' 
        ? meta.sourceType as 'slides' | 'body' | 'video_transcript' | 'chapter'
        : undefined
      const slidePageNum = typeof meta.slidePageNum === 'number' 
        ? meta.slidePageNum 
        : undefined
      const slideTitle = typeof meta.slideTitle === 'string' 
        ? meta.slideTitle 
        : undefined
      const chapterTitle = typeof meta.chapterTitle === 'string' 
        ? meta.chapterTitle 
        : undefined
      const chapterOrder = typeof meta.chapterOrder === 'number' 
        ? meta.chapterOrder 
        : undefined
      
      // Extrahiere Metadaten basierend auf Facetten-Definitionen
      const facetMetadata = extractFacetMetadata(meta, facetDefs)
      
      // Budget-Prüfung: Wenn Budget überschritten wird, stoppe
      if (used + text.length > budget) break
      
      sources.push({
        id: chunk.id,
        score: 1.0, // Keine Relevanz-Scores bei chunkSummary (alle Chunks gleichwertig)
        fileName,
        fileId,
        chunkIndex,
        text,
        sourceType,
        slidePageNum,
        slideTitle,
        chapterTitle,
        chapterOrder,
        metadata: Object.keys(facetMetadata).length > 0 ? facetMetadata : undefined,
      })
      
      used += text.length
    }

    return { 
      sources, 
      timing: { retrievalMs: Date.now() - t0 },
      stats: { 
        candidatesCount: allChunks.length, 
        usedInPrompt: sources.length 
      }
    }
  }
}

