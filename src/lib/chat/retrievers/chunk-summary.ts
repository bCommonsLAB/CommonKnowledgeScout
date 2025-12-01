/**
 * @fileoverview Chunk Summary Retriever - Alle Chunks ohne Embedding-Suche
 * 
 * @description
 * Lädt alle Chunks der gefilterten Dokumente aus MongoDB OHNE Embedding-Suche.
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
 * - @/lib/repositories/vector-repo: MongoDB Vector Search Operations
 * - @/lib/chat/common/budget: Budget-Verwaltung
 * - @/lib/logging/query-logger: Query-Logging
 * - @/lib/chat/retrievers/metadata-extractor: Metadaten-Extraktion
 */

import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { getBaseBudget } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend } from '@/lib/logging/query-logger'
import { extractFacetMetadata } from './metadata-extractor'
import { findDocs, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { getRetrieverContext } from '@/lib/chat/retriever-context'

const env = {
  maxDocs: Number(process.env.CHUNK_SUMMARY_MAX_DOCS ?? 100),
}

export const chunkSummaryRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // Retriever-Context laden (enthält alle benötigten Konfigurationswerte)
    const retrieverCtx = await getRetrieverContext(input.userEmail || '', input.libraryId)
    const { libraryKey, facetDefs } = retrieverCtx

    const budget = getBaseBudget(input.answerLength)

    // Schritt 1: Gefilterte Dokumente aus MongoDB abrufen (nur fileIds)
    
    let stepList = markStepStart({ indexName: libraryKey, namespace: '', stage: 'list', level: 'chunkSummary' })
    
    const docs = await findDocs(libraryKey, input.libraryId, input.filters || {}, {
      limit: env.maxDocs,
      sort: { upsertedAt: -1 },
    })
    
    const fileIds = docs.items.map(d => d.fileId).filter((id): id is string => typeof id === 'string' && id.length > 0)
    
    if (fileIds.length === 0) {
      stepList = markStepEnd({ ...stepList, topKReturned: 0 })
      await logAppend(input.queryId, {
        indexName: libraryKey,
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
        },
      })
      return { sources: [], timing: { retrievalMs: Date.now() - t0 }, stats: { candidatesCount: 0, usedInPrompt: 0 } }
    }

    stepList = markStepEnd({ ...stepList, topKReturned: fileIds.length })
    await logAppend(input.queryId, {
      indexName: libraryKey,
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
      },
    })

    // Schritt 2: Alle Chunks dieser Dokumente aus MongoDB abrufen (OHNE Embedding-Suche)
    let stepQuery = markStepStart({ 
      indexName: libraryKey, 
      namespace: '', 
      stage: 'query',
      level: 'chunkSummary',
      filtersEffective: { normalized: input.filters || {} },
      queryVectorInfo: { source: 'question' }, // Keine Embedding-Suche (verwendet 'question' als Fallback)
    })
    
    // Direkte MongoDB-Abfrage ohne Vector Search
      const col = await getCollectionOnly(libraryKey)
    const chunks = await col.find(
      {
        kind: 'chunk',
        libraryId: input.libraryId,
        user: input.userEmail || '',
        fileId: { $in: fileIds },
      },
      {
        projection: {
          _id: 1,
          fileId: 1,
          fileName: 1,
          chunkIndex: 1,
          text: 1,
          headingContext: 1,
          startChar: 1,
          endChar: 1,
          year: 1,
          authors: 1,
          region: 1,
          docType: 1,
          source: 1,
          tags: 1,
          topics: 1,
          track: 1,
          speakers: 1,
          date: 1,
          shortTitle: 1,
          sourceType: 1,
          slidePageNum: 1,
          slideTitle: 1,
          chapterTitle: 1,
          chapterOrder: 1,
          chapterId: 1,
        },
      }
    )
    .sort({ fileId: 1, chunkIndex: 1 })
    .limit(10000)
    .toArray()
    
    // Konvertiere zu Array<{ id: string; metadata: Record<string, unknown> }>
    const allChunks = chunks.map(doc => ({
      id: String(doc._id),
      metadata: {
        libraryId: doc.libraryId as string,
        user: doc.user as string,
        fileId: doc.fileId as string,
        fileName: doc.fileName as string,
        kind: doc.kind as string,
        chunkIndex: doc.chunkIndex as number,
        text: doc.text as string,
        headingContext: doc.headingContext as string | undefined,
        startChar: doc.startChar as number | undefined,
        endChar: doc.endChar as number | undefined,
        year: doc.year as number | undefined,
        authors: doc.authors as string[] | undefined,
        region: doc.region as string | undefined,
        docType: doc.docType as string | undefined,
        source: doc.source as string | undefined,
        tags: doc.tags as string[] | undefined,
        topics: doc.topics as string[] | undefined,
        track: doc.track as string | undefined,
        speakers: doc.speakers as string[] | undefined,
        date: doc.date as string | undefined,
        shortTitle: doc.shortTitle as string | undefined,
        sourceType: doc.sourceType as string | undefined,
        slidePageNum: doc.slidePageNum as number | undefined,
        slideTitle: doc.slideTitle as string | undefined,
        chapterTitle: doc.chapterTitle as string | undefined,
        chapterOrder: doc.chapterOrder as number | undefined,
        chapterId: doc.chapterId as string | undefined,
      },
    }))
    
    stepQuery = markStepEnd({ ...stepQuery, topKReturned: allChunks.length })
    await logAppend(input.queryId, {
      indexName: libraryKey,
      namespace: '',
      stage: 'query',
      level: 'chunkSummary',
      topKRequested: allChunks.length,
      topKReturned: allChunks.length,
      filtersEffective: { normalized: input.filters || {} },
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

