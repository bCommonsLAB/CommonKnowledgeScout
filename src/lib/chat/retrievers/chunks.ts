/**
 * @fileoverview Chunks Retriever - Semantic Search Retriever for Chunks
 * 
 * @description
 * Implements chunk-based retrieval using MongoDB Atlas Vector Search. Searches for semantically
 * similar text chunks based on question embeddings. Supports facet filtering and metadata
 * extraction. Handles both regular chunks and chapter summaries.
 * 
 * @module chat
 * 
 * @exports
 * - chunksRetriever: Chunk-based retriever implementation
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Orchestrator uses retriever for chunk mode
 * - src/app/api/chat/[libraryId]/stream/route.ts: Chat endpoint uses retriever
 * 
 * @dependencies
 * - @/lib/chat/embeddings: Text embedding generation
 * - @/lib/repositories/vector-repo: MongoDB Vector Search operations
 * - @/lib/chat/common/budget: Budget management
 * - @/lib/logging/query-logger: Query logging
 * - @/lib/chat/retrievers/metadata-extractor: Metadata extraction
 */

import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { queryVectors, convertShortTitleToFileIds } from '@/lib/repositories/vector-repo'
import { getBaseBudget, getTokenBudget } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend } from '@/lib/logging/query-logger'
import { extractFacetMetadata } from './metadata-extractor'
import { getRetrieverContext } from '@/lib/chat/retriever-context'
import { buildVectorSearchFilter } from '@/lib/chat/common/filters'
import { FileLogger } from '@/lib/debug/logger'
import type { Document } from 'mongodb'

// Helper: Sende Debug-Info als Processing-Step (falls onProcessingStep verfügbar)
function sendDebugStep(
  onProcessingStep: ((step: import('@/types/chat-processing').ChatProcessingStep) => void) | undefined,
  message: string,
  details?: Record<string, unknown>
) {
  if (onProcessingStep) {
    // Verwende retrieval_progress für Debug-Informationen
    onProcessingStep({
      type: 'retrieval_progress',
      sourcesFound: 0,
      message: details ? `${message} | ${JSON.stringify(details)}` : message,
    })
  }
}

export const chunksRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput & { onProcessingStep?: (step: import('@/types/chat-processing').ChatProcessingStep) => void }): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // Retriever-Context laden (enthält alle benötigten Konfigurationswerte)
    const retrieverCtx = await getRetrieverContext(input.userEmail || '', input.libraryId)
    const { ctx, libraryKey, dimension, facetDefs } = retrieverCtx

    const budget = getBaseBudget(input.answerLength)
    // Dynamisches Top-K basierend auf Budget und answerLength: Optimiert für große wissenschaftliche Dokumente
    // Durchschnittliche Chunk-Größe: ~1000 Zeichen
    const avgChunkSize = 1000
    
    // Berechne Top-K basierend auf Budget
    let baseTopK: number
    if (input.answerLength === 'unbegrenzt') {
      // Für unbegrenzt: Verwende Token-Limit falls verfügbar
      const tokenBudget = getTokenBudget()
      if (tokenBudget) {
        const charBudget = tokenBudget * 4 // ~4 Zeichen pro Token
        baseTopK = Math.floor((charBudget * 0.6) / avgChunkSize) // 60% für Chunks, 40% für Prompt-Overhead
        baseTopK = Math.min(baseTopK, 300) // Max 300 Chunks
      } else {
        baseTopK = 250
      }
    } else {
      // Reserve 20% für Nachbarn
      const availableBudget = budget * 0.8
      baseTopK = Math.floor(availableBudget / avgChunkSize)
      // Mindestwerte sicherstellen basierend auf answerLength
      baseTopK = Math.max(baseTopK, 
        input.answerLength === 'ausführlich' ? 150 
        : input.answerLength === 'mittel' ? 80 
        : 40
      )
    }
    
    // Schritt 1: shortTitle-Filter zu FileIDs konvertieren (falls vorhanden)
    // Alle anderen Facetten-Filter werden direkt in Vector Search verwendet
    let fileIds: string[] | undefined = undefined
    const filters = input.filters || {}
    if (filters.shortTitle) {
      const shortTitleValue = filters.shortTitle
      const shortTitle = typeof shortTitleValue === 'string' 
        ? shortTitleValue 
        : Array.isArray(shortTitleValue) 
        ? shortTitleValue.map(v => String(v))
        : String(shortTitleValue)
      fileIds = await convertShortTitleToFileIds(libraryKey, input.libraryId, shortTitle)
      
      if (fileIds.length === 0) {
        console.warn('[Chunks Retriever] Keine Dokumente gefunden mit shortTitle-Filter:', shortTitle)
        return { sources: [], timing: { retrievalMs: Date.now() - t0 }, stats: { candidatesCount: 0, usedInPrompt: 0 } }
      }
    }

    // Schritt 2: Embedding-Vektor generieren über Secretary Service RAG API
    let stepEmbed = markStepStart({ indexName: libraryKey, namespace: '', stage: 'embed', level: 'question' })
    const { embedQuestionWithSecretary } = await import('@/lib/chat/rag-embeddings')
    const qVec = await embedQuestionWithSecretary(input.question, retrieverCtx.ctx)
    stepEmbed = markStepEnd(stepEmbed)
    await logAppend(input.queryId, { indexName: libraryKey, namespace: '', stage: 'embed', level: 'question', timingMs: stepEmbed.timingMs, startedAt: stepEmbed.startedAt, endedAt: stepEmbed.endedAt })

    // Schritt 3: MongoDB Vector Search Query mit allen Filtern (parallel für Chunks und Chapter-Summaries)
    // Filter aufbauen: Basis-Filter + Facetten-Filter + fileId-Filter (falls vorhanden)
    const baseFilter = buildVectorSearchFilter(
      input.libraryId,
      input.userEmail || '',
      'chunk',
      input.filters,
      fileIds
    )

    // Collection bereits parallel zur Query vorbereiten (Performance-Optimierung)
    // Wird für Nachbarn-Lookup benötigt, kann parallel zur Query vorbereitet werden
    const collectionTask = (async () => {
      const { getCollectionOnly } = await import('@/lib/repositories/vector-repo')
      return await getCollectionOnly(libraryKey)
    })()

    const chunkTask = (async () => {
      let s = markStepStart({ indexName: libraryKey, namespace: '', stage: 'query', level: 'chunk', filtersEffective: { normalized: filters }, queryVectorInfo: { source: 'question' } })
      
      // Reduziertes Logging (Performance-Optimierung)
      FileLogger.info('chunks-retriever', 'Starte Chunk-Query', {
        libraryKey,
        libraryId: input.libraryId,
        topK: baseTopK,
        dimension,
      })
      
      try {
        const res = await queryVectors(
          libraryKey,
          qVec,
          baseTopK,
          baseFilter,
          dimension,
          ctx.library
        )
        
        // Reduziertes Logging nach der Query (Performance-Optimierung)
        FileLogger.info('chunks-retriever', 'Chunk-Query abgeschlossen', {
          libraryKey,
          topKRequested: baseTopK,
          topKReturned: res.length,
        })
        sendDebugStep(input.onProcessingStep, `Query: ${res.length}/${baseTopK} Chunks gefunden`, {
          topKRequested: baseTopK,
          topKReturned: res.length,
        })
        
        if (res.length === 0) {
          const noResultsInfo = {
            libraryKey,
            libraryId: input.libraryId,
            topK: baseTopK,
            filter: JSON.stringify(baseFilter),
            dimension,
            queryVectorLength: qVec.length,
            // Prüfe ob Query-Vektor gültig ist
            queryVectorSample: qVec.slice(0, 5),
            queryVectorHasNaN: qVec.some(v => Number.isNaN(v)),
            queryVectorHasInfinity: qVec.some(v => !Number.isFinite(v)),
          }
          FileLogger.warn('chunks-retriever', 'Keine Chunks gefunden', noResultsInfo)
          sendDebugStep(input.onProcessingStep, `⚠️ Keine Chunks gefunden! Filter: ${JSON.stringify(baseFilter)}`, noResultsInfo)
        }
        
        s = markStepEnd({ ...s, topKRequested: baseTopK, topKReturned: res.length })
        return { matches: res, step: s }
      } catch (queryError) {
        FileLogger.error('chunks-retriever', 'Fehler bei Chunk-Query', {
          libraryKey,
          libraryId: input.libraryId,
          topK: baseTopK,
          filter: JSON.stringify(baseFilter),
          dimension,
          error: queryError instanceof Error ? queryError.message : String(queryError),
          stack: queryError instanceof Error ? queryError.stack : undefined,
        })
        throw queryError
      }
    })()

    const summaryTask = (async () => {
      try {
        const summaryFilter = { ...baseFilter }
        let s = markStepStart({ indexName: libraryKey, namespace: '', stage: 'query', level: 'summary', filtersEffective: { normalized: filters }, queryVectorInfo: { source: 'question' } })
        
        // Reduziertes Logging (Performance-Optimierung)
        FileLogger.info('chunks-retriever', 'Starte Chapter-Summary-Query', {
          libraryKey,
          topK: 10,
        })
        
        const res = await queryVectors(
          libraryKey,
          qVec,
          10,
          summaryFilter,
          dimension,
          ctx.library
        )
        
        // Filtere auf chapterSummary (wird bereits im queryVectors durch kind-Filter gemacht)
        const chapterMatches = res.filter(m => m.metadata.kind === 'chapterSummary')
        
        FileLogger.info('chunks-retriever', 'Chapter-Summary-Query abgeschlossen', {
          libraryKey,
          topKRequested: 10,
          topKReturned: res.length,
          chapterMatches: chapterMatches.length,
        })
        
        s = markStepEnd({ ...s, topKRequested: 10, topKReturned: chapterMatches.length })
        return { chapterMatches, step: s }
      } catch (summaryError) {
        FileLogger.error('chunks-retriever', 'Fehler bei Chapter-Summary-Query', {
          libraryKey,
          error: summaryError instanceof Error ? summaryError.message : String(summaryError),
        })
        return { chapterMatches: [], step: undefined as unknown as ReturnType<typeof markStepStart> }
      }
    })()

    const [{ matches, step: stepQ }, { chapterMatches, step: stepC }] = await Promise.all([chunkTask, summaryTask])
    await logAppend(input.queryId, {
      indexName: libraryKey,
      namespace: '',
      stage: 'query',
      level: 'chunk',
      topKRequested: baseTopK,
      topKReturned: matches.length,
      filtersEffective: { normalized: filters },
      queryVectorInfo: { source: 'question' },
      timingMs: stepQ.timingMs,
      startedAt: stepQ.startedAt,
      endedAt: stepQ.endedAt,
      results: matches.slice(0, 20).map(m => ({ id: m.id, type: 'chunk', score: m.score, metadata: m.metadata })),
    })
    if (Array.isArray(chapterMatches) && chapterMatches.length > 0) {
      await logAppend(input.queryId, {
        indexName: libraryKey,
        namespace: '',
        stage: 'query',
        level: 'summary',
        topKRequested: 10,
        topKReturned: chapterMatches.length,
        filtersEffective: { normalized: filters },
        queryVectorInfo: { source: 'question' },
        timingMs: stepC?.timingMs,
        startedAt: stepC?.startedAt,
        endedAt: stepC?.endedAt,
        results: chapterMatches.slice(0, 20).map(m => ({ id: m.id, type: 'summary', score: m.score, metadata: m.metadata })),
      })
    }

    const chapterBoost = new Map<string, number>()
    if (Array.isArray(chapterMatches)) {
      const base = 1.0
      const step = 0.05
      chapterMatches.forEach((m, i) => {
        const meta = m.metadata
        const chapterId = typeof meta.chapterId === 'string' ? meta.chapterId : undefined
        if (!chapterId) return
        const score = base - i * step
        if (!chapterBoost.has(chapterId)) chapterBoost.set(chapterId, Math.max(0, score))
      })
    }

    // Dynamische Window-Größe: Größere Windows für wissenschaftliche Dokumente
    const baseWindow = input.answerLength === 'unbegrenzt' ? 8 
      : input.answerLength === 'ausführlich' ? 6 
      : input.answerLength === 'mittel' ? 4 
      : 2
    // Dynamische Anpassung basierend auf Anzahl der Matches (nur reduzieren, nicht erhöhen)
    const dynamicWindow = matches.length > 200 ? Math.max(4, baseWindow - 2)
      : matches.length > 100 ? Math.max(3, baseWindow - 1)
      : baseWindow
    const windowByLength = dynamicWindow
    
    // Parse IDs und sammle Nachbar-IDs
    const parseId = (id: string) => {
      const idxDash = id.lastIndexOf('-')
      if (idxDash < 0) return { base: id, chunk: NaN }
      return { base: id.slice(0, idxDash), chunk: Number(id.slice(idxDash + 1)) }
    }
    const toId = (base: string, chunk: number) => `${base}-${chunk}`
    
    const idSet = new Set<string>()
    const idToMatch = new Map<string, typeof matches[0]>()
    
    for (const m of matches) {
      idToMatch.set(m.id, m)
      const { base, chunk } = parseId(m.id)
      if (!Number.isFinite(chunk)) {
        idSet.add(m.id)
        continue
      }
      for (let d = -windowByLength; d <= windowByLength; d++) {
        idSet.add(toId(base, chunk + d))
      }
    }
    
    // Hole Nachbar-Vektoren aus MongoDB (falls benötigt)
    // Collection wurde bereits parallel zur Query vorbereitet (Performance-Optimierung)
    const neighborIds = Array.from(idSet).filter(id => !idToMatch.has(id))
    let neighbors: typeof matches = []
    
    if (neighborIds.length > 0) {
      // Collection wurde bereits parallel zur Query vorbereitet
      const col = await collectionTask
      const neighborDocs = await col.find(
        {
          _id: { $in: neighborIds },
          kind: 'chunk',
          libraryId: input.libraryId,
          // user-Filter entfernt: libraryId ist ausreichend für Filterung
        } as Partial<Document>,
        {
          projection: {
            _id: 1,
            text: 1,
            chunkIndex: 1,
            fileId: 1,
            fileName: 1,
            headingContext: 1,
            startChar: 1,
            endChar: 1,
            year: 1,
            authors: 1,
            region: 1,
            docType: 1,
            source: 1,
            tags: 1,
            shortTitle: 1,
          },
        }
      ).toArray()
      
      neighbors = neighborDocs.map(doc => ({
        id: String(doc._id),
        score: input.answerLength === 'unbegrenzt' ? 0.3 : 0, // Bei unbegrenzt: Gebe Nachbarn einen minimalen Score, damit sie nicht aussortiert werden
        metadata: {
          libraryId: doc.libraryId as string,
          user: doc.user as string,
          fileId: doc.fileId as string,
          fileName: doc.fileName as string,
          kind: 'chunk',
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
          shortTitle: doc.shortTitle as string | undefined,
        },
      }))
    }
    
    // Kombiniere Matches und Nachbarn
    const allRows = [...matches, ...neighbors]
    const rowsMap = new Map<string, typeof matches[0]>()
    for (const row of allRows) {
      if (!rowsMap.has(row.id) || row.score > (rowsMap.get(row.id)?.score || 0)) {
        rowsMap.set(row.id, row)
      }
    }
    
    const rows = Array.from(rowsMap.values())

    const chapterAlpha = Number(process.env.CHAT_CHAPTER_BOOST ?? 0.15)
    
    // Score-Boosting und Sortierung
    const processedRows = rows
      .map(r => {
        const meta = r.metadata
        const chapterId = typeof meta.chapterId === 'string' ? meta.chapterId : undefined
        let boosted = r.score
        
        if (chapterId && chapterBoost.size > 0) {
          const b = chapterBoost.get(chapterId)
          if (typeof b === 'number') boosted = boosted + chapterAlpha * b
        }
        
        try {
          const q = input.question.toLowerCase()
          const title = typeof meta.chapterTitle === 'string' ? meta.chapterTitle.toLowerCase() : ''
          const kws = Array.isArray(meta.keywords) 
            ? (meta.keywords as unknown[]).filter(v => typeof v === 'string').map(v => String(v).toLowerCase())
            : []
          let lex = 0
          if (title && q && title.includes(q)) lex += 0.02
          for (const kw of kws) {
            if (kw && q.includes(kw)) {
              lex += 0.02
              if (lex > 0.06) break
            }
          }
          boosted += lex
        } catch {}
        
        return { ...r, score: boosted }
      })
      .sort((a, b) => b.score - a.score)

    const sources: RetrievedSource[] = []
    let used = 0
    const initialMatchesCount = matches.length
    const neighborsCount = neighbors.length
    const totalRowsCount = processedRows.length
    
    for (const r of processedRows) {
      const meta = r.metadata
      const t = typeof meta.text === 'string' ? meta.text : ''
      if (!t) continue
      const fileName = typeof meta.fileName === 'string' ? meta.fileName : undefined
      const chunkIndex = typeof meta.chunkIndex === 'number' ? meta.chunkIndex : undefined
      
      // Extrahiere fileId für Gruppierung
      let fileId = typeof meta.fileId === 'string' ? meta.fileId : undefined
      if (!fileId) {
        // Fallback: Extrahiere aus id
        const parts = r.id.split('-')
        const lastPart = parts[parts.length - 1]
        if (lastPart && (/^\d+$/.test(lastPart) || lastPart.startsWith('chap'))) {
          fileId = parts.slice(0, -1).join('-')
        } else {
          fileId = parts.slice(0, -1).join('-') || r.id
        }
      }
      
      // Extrahiere sourceType und zusätzliche Metadaten für benutzerfreundliche Beschreibungen
      const sourceType = typeof meta.sourceType === 'string' 
        ? meta.sourceType as 'slides' | 'body' | 'video_transcript' | 'chapter'
        : undefined
      const slidePageNum = typeof meta.slidePageNum === 'number' ? meta.slidePageNum : undefined
      const slideTitle = typeof meta.slideTitle === 'string' ? meta.slideTitle : undefined
      const chapterTitle = typeof meta.chapterTitle === 'string' ? meta.chapterTitle : undefined
      const chapterOrder = typeof meta.chapterOrder === 'number' ? meta.chapterOrder : undefined
      
      // Extrahiere Metadaten basierend auf Facetten-Definitionen
      const facetMetadata = extractFacetMetadata(meta, facetDefs)
      
      const s: RetrievedSource = { 
        id: r.id, 
        score: r.score, 
        fileName, 
        fileId,
        chunkIndex, 
        text: t,
        sourceType,
        slidePageNum,
        slideTitle,
        chapterTitle,
        chapterOrder,
        metadata: Object.keys(facetMetadata).length > 0 ? facetMetadata : undefined, // Nur wenn Werte vorhanden sind
      }
      
      // Budget-Check: Bei unbegrenzt verwende Token-Limit falls verfügbar
      if (input.answerLength === 'unbegrenzt') {
        const tokenBudget = getTokenBudget()
        if (tokenBudget) {
          const currentTokens = Math.ceil(used / 4) // ~4 Zeichen pro Token
          const addTokens = Math.ceil(t.length / 4)
          // Reserve 15% für Prompt-Overhead und Output (weniger Reserve = mehr Chunks)
          // Bei unbegrenzt: Nutze deutlich mehr vom verfügbaren Budget
          const availableTokens = Math.floor(tokenBudget * 0.85)
          
          // Bei unbegrenzt: Verwende auch Chunks mit niedrigerem Score
          // Stoppe nur wenn Budget wirklich erreicht ist UND Score sehr niedrig (< 0.3)
          const minScoreForUnlimited = 0.3
          if (currentTokens + addTokens > availableTokens) {
            // Budget erreicht, aber prüfe ob Score noch hoch genug ist
            // Wenn Score hoch ist (> 0.5), verwende trotzdem (kann leicht über Budget gehen)
            if (r.score < 0.5) break
          }
          // Wenn Score sehr niedrig ist, stoppe auch bei unbegrenzt
          if (r.score < minScoreForUnlimited) break
        } else {
          // Falls kein Token-Limit: Keine Budget-Beschränkung, aber Score-Minimum prüfen
          const minScoreForUnlimited = 0.3
          if (r.score < minScoreForUnlimited) break
        }
      } else {
        // Normale Budget-Prüfung für andere answerLength-Werte
        if (used + t.length > budget) break
      }
      
      sources.push(s)
      used += t.length
    }
    
    // Verbessertes Logging für Retrieval-Statistiken
    const retrievalStats = {
      topKRequested: baseTopK,
      initialMatches: initialMatchesCount,
      neighborsAdded: neighborsCount,
      totalRowsProcessed: totalRowsCount,
      sourcesUsed: sources.length,
      budgetUsed: used,
      budgetAvailable: budget,
      budgetUtilization: budget !== Number.MAX_SAFE_INTEGER ? `${((used / budget) * 100).toFixed(1)}%` : 'unlimited',
      answerLength: input.answerLength,
    }
    
    FileLogger.info('chunks-retriever', 'Retrieval abgeschlossen', retrievalStats)
    sendDebugStep(input.onProcessingStep, 
      `Retrieved ${sources.length} chunks (${initialMatchesCount} matches, ${neighborsCount} neighbors, ${used.toLocaleString()}/${budget !== Number.MAX_SAFE_INTEGER ? budget.toLocaleString() : 'unlimited'} chars)`, 
      retrievalStats
    )
    // Prüfe auf Warnung: Wenn alle Scores < 0.7, generiere Warnung
    const RAG_MIN_SCORE_THRESHOLD = 0.4
    const hasRelevantDocs = sources.some(s => typeof s.score === 'number' && s.score >= RAG_MIN_SCORE_THRESHOLD)
    const warning = !hasRelevantDocs && sources.length > 0
      ? 'Die zugrundeliegenden Dokumente enthalten zu wenig passenden Inhalt. Bitte formulieren Sie die Frage um oder erweitern Sie die Anzahl der zugrundeliegenden Dokumente (Facettenfilter anpassen).'
      : undefined

    return { 
      sources, 
      timing: { retrievalMs: Date.now() - t0 }, 
      stats: {
        candidatesCount: totalRowsCount,
        usedInPrompt: sources.length,
        // Zusätzliche Stats für präzisere Anzeige
        initialMatches: initialMatchesCount,
        neighborsAdded: neighborsCount,
        topKRequested: baseTopK,
        budgetUsed: used,
        answerLength: input.answerLength,
      },
      warning 
    }
  }
}


