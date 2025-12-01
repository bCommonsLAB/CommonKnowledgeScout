/**
 * @fileoverview Summaries MongoDB Retriever - Document Summary Retriever
 * 
 * @description
 * Implements summary-based retrieval using MongoDB. Searches for document summaries
 * and chapter summaries. Supports three modes:
 * - 'chapters': Uses chapter summaries (detailliert, für bis zu 10 Dokumente bei TOC)
 * - 'summary': Uses document summaries (detailliert auf Dokumentenebene, für 11-79 Dokumente bei TOC)
 * - 'teaser': Uses document teasers (kompakt, für ab 80 Dokumente bei TOC)
 * Handles event mode for session-based documents.
 * 
 * @module chat
 * 
 * @exports
 * - summariesMongoRetriever: Summary-based retriever implementation
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Orchestrator uses retriever for summary mode
 * - src/app/api/chat/[libraryId]/stream/route.ts: Chat endpoint uses retriever
 * 
 * @dependencies
 * - @/lib/repositories/vector-repo: Vector repository (MongoDB Vector Search)
 * - @/lib/chat/common/budget: Budget management
 * - @/lib/logging/query-logger: Query logging
 * - @/lib/chat/retrievers/metadata-extractor: Metadata extraction
 * - @/lib/chat/loader: Library context loading
 */

import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { appendRetrievalStep as logAppend, markStepStart, markStepEnd } from '@/lib/logging/query-logger'
import { getBaseBudget, canAccumulate, getTokenBudget, estimateTokensFromText, canAccumulateTokens } from '@/lib/chat/common/budget'
import { extractFacetMetadata } from './metadata-extractor'
import { TOC_QUESTION } from '@/lib/chat/constants'
import { getRetrieverContext } from '@/lib/chat/retriever-context'

const env = {
  maxDocs: Number(process.env.SUMMARY_MAX_DOCS ?? 150),
  chaptersThreshold: Number(process.env.SUMMARY_CHAPTERS_THRESHOLD ?? 300),
  perDocChapterCap: Number(process.env.SUMMARY_PER_DOC_CHAPTER_CAP ?? 8),
  estimateCharsPerChapter: Number(process.env.SUMMARY_ESTIMATE_CHARS_PER_CHAPTER ?? 800),
  estimateCharsPerDoc: Number(process.env.SUMMARY_ESTIMATE_CHARS_PER_DOC ?? 1200),
}

type SummaryMode = 'chapters' | 'summary' | 'teaser'

/**
 * Entscheidet den optimalen Summary-Modus basierend auf:
 * - Dokumentenanzahl (für TOC-Queries)
 * - Verfügbarkeit von Chapters
 * - Budget-Beschränkungen
 * 
 * Strategie für TOC-Queries:
 * - ≤10 Dokumente: chapters (detailliert, Kapitel-Summaries)
 * - 11-79 Dokumente: summary (detailliert auf Dokumentenebene)
 * - ≥80 Dokumente: teaser (kompakt, Teaser-Text)
 */
function decideSummaryMode(
  docs: Array<{ chaptersCount?: number; summary?: string; teaser?: string }>,
  budgetChars: number,
  isEventMode: boolean,
  isTOCQuery: boolean
): SummaryMode {
  const docCount = docs.length
  
  // KRITISCH: Im Event-Modus (Session) verwenden wir IMMER 'summary' oder 'teaser'
  // Event-Dokumente haben keine Chapters, nur docMetaJson.summary/teaser
  if (isEventMode) {
    // Für TOC-Queries: Basierend auf Dokumentenanzahl entscheiden
    if (isTOCQuery) {
      if (docCount >= 80) return 'teaser'  // Ab 80 Dokumenten: Teaser
      return 'summary'  // Bis 79 Dokumenten: Summary
    }
    return 'summary'  // Normale Queries: Summary
  }
  
  // Für TOC-Queries: Optimierte Entscheidung basierend auf Dokumentenanzahl
  if (isTOCQuery) {
    if (docCount <= 10) {
      // Bis 10 Dokumenten: Chapters (detailliert)
      const limitedDocs = docs.slice(0, 10)
      const estChapters = limitedDocs
        .map(d => Math.min(Math.max(0, d.chaptersCount ?? 0), env.perDocChapterCap))
        .reduce((a, b) => a + b, 0)
      
      if (estChapters > 0) {
        const estCharsChapters = estChapters * env.estimateCharsPerChapter
        if (estCharsChapters <= budgetChars) {
          return 'chapters'
        }
      }
    }
    
    // 11-79 Dokumenten: Summary (detailliert auf Dokumentenebene)
    if (docCount < 80) {
      return 'summary'
    }
    
    // Ab 80 Dokumenten: Teaser (kompakt)
    return 'teaser'
  }
  
  // Normale Queries: Bestehende Logik (chapters oder summary)
  const limitedDocs = docs.slice(0, env.maxDocs)
  const estChapters = limitedDocs
    .map(d => Math.min(Math.max(0, d.chaptersCount ?? 0), env.perDocChapterCap))
    .reduce((a, b) => a + b, 0)
  
  if (estChapters === 0) return 'summary'
  
  const estCharsChapters = estChapters * env.estimateCharsPerChapter
  if (estChapters <= env.chaptersThreshold && estCharsChapters <= budgetChars) {
    return 'chapters'
  }
  
  return 'summary'
}

export const summariesMongoRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // Retriever-Context laden (enthält alle benötigten Konfigurationswerte)
    const retrieverCtx = await getRetrieverContext(input.userEmail || '', input.libraryId)
    const { ctx, libraryKey, facetDefs } = retrieverCtx
    const isEventMode = ctx.chat.gallery.detailViewType === 'session'
    
    // HINWEIS: Wir nutzen hier vector-repo für MongoDB Vector Search.
    // findDocSummaries filtert automatisch nach kind: 'meta'.
    // Dynamische Importe vermeiden Zyklen.
    const { findDocSummaries } = await import('@/lib/repositories/vector-repo')

    // Logging: list(summary) Step öffnen
    const { VECTOR_SEARCH_INDEX_NAME } = await import('@/lib/chat/vector-search-index')
    let stepList = markStepStart({ indexName: VECTOR_SEARCH_INDEX_NAME, namespace: '', stage: 'list', level: 'summary' })
    
    // Im Event-Modus keine Chapters laden (Performance-Optimierung)
    // Dokumente werden nach upsertedAt abwärts sortiert (neueste zuerst)
    const items = await findDocSummaries(libraryKey, input.libraryId, input.filters, { 
      limit: env.maxDocs, 
      sort: { upsertedAt: -1 } 
    }, isEventMode)

    const budgetChars = getBaseBudget(input.answerLength)
    const budgetTokens = getTokenBudget()
    
    // Prüfe, ob es eine TOC-Query ist (erkennbar durch die Frage)
    const isTOCQuery = input.question.trim() === TOC_QUESTION.trim()
    
    // Entscheide den optimalen Mode basierend auf Dokumentenanzahl und TOC-Status
    const mode = decideSummaryMode(
      items as Array<{ chaptersCount?: number; summary?: string; teaser?: string }>,
      budgetChars,
      isEventMode,
      isTOCQuery
    )

    const sources: RetrievedSource[] = []
    let usedChars = 0
    let usedTokens = 0
    let budgetWarning: string | undefined = undefined

    // IM SUMMARY-MODUS: 
    // - Für normale Queries: Alle gefilterten Dokumente übernehmen (Budget-Limitierung optional)
    // - Für TOC-Queries: Budget-Prüfung mit Warnung (kein Abschneiden, vollständiger Text wird verwendet)
    for (const d of items) {
      // Extrahiere Metadaten aus dem Dokument basierend auf Facetten-Definitionen
      const docMeta = d as Record<string, unknown>
      const facetMetadata = extractFacetMetadata(docMeta, facetDefs)
      const hasMetadata = Object.keys(facetMetadata).length > 0
      
      if (mode === 'chapters') {
        const ch = Array.isArray(d.chapters) ? d.chapters.slice(0, env.perDocChapterCap) : []
        
        for (const c of ch) {
          const title = typeof c?.title === 'string' ? c.title : undefined
          const sum = typeof c?.summary === 'string' ? c.summary : undefined
          if (!sum) continue
          
          // WICHTIG: Bei TOC-Queries NICHT abschneiden (führt zu falschen Ergebnissen)
          const text = isTOCQuery 
            ? `${title ? `Kapitel: ${title}\n` : ''}${sum}`
            : `${title ? `Kapitel: ${title}\n` : ''}${sum.slice(0, env.estimateCharsPerChapter)}`
          
          // Budget-Prüfung: Für TOC-Queries Warnung statt Abbruch, sonst nur Warnung
          if (isTOCQuery) {
            // TOC-Query: Budget-Prüfung mit Warnung (kein Abschneiden, vollständiger Text wird verwendet)
            // Prüfe sowohl Zeichen- als auch Token-Budget
            const wouldExceedChars = !canAccumulate(usedChars, text.length, budgetChars)
            const wouldExceedTokens = budgetTokens ? !canAccumulateTokens(usedTokens, estimateTokensFromText(text), budgetTokens) : false
            
            if (wouldExceedChars || wouldExceedTokens) {
              // Budget überschritten: Warnung ausgeben, aber Text trotzdem verwenden (kein break)
              const exceededChars = wouldExceedChars ? `Zeichen-Budget überschritten (${usedChars + text.length}/${budgetChars})` : ''
              const exceededTokens = wouldExceedTokens && budgetTokens ? `Token-Budget überschritten (${usedTokens + estimateTokensFromText(text)}/${budgetTokens})` : ''
              const parts = [exceededChars, exceededTokens].filter(Boolean)
              if (parts.length > 0 && !budgetWarning) {
                budgetWarning = `⚠️ Budget-Warnung bei TOC-Query: ${parts.join(', ')}. Alle Dokumente werden trotzdem verwendet (kein Abschneiden).`
              }
            }
          } else {
            // Normale Query: Budget prüfen, aber nicht abbrechen (nur Warnung)
            void canAccumulate(usedChars, text.length, budgetChars)
            const est = budgetTokens ? estimateTokensFromText(text) : 0
            void (budgetTokens ? canAccumulateTokens(usedTokens, est, budgetTokens) : true)
          }
          
          sources.push({ 
            id: String(d.fileId ?? ''), 
            fileName: typeof d.fileName === 'string' ? d.fileName : undefined, 
            text,
            metadata: hasMetadata ? facetMetadata : undefined,
          })
          usedChars += text.length
          if (budgetTokens) usedTokens += estimateTokensFromText(text)
        }
      } else if (mode === 'summary') {
        // Summary-Modus: Verwende summary-Feld (detailliert auf Dokumentenebene)
        const doc = d as { summary?: string; docSummary?: string }
        const summary = doc.summary || doc.docSummary || ''
        
        if (!summary) continue
        
        // WICHTIG: Bei TOC-Queries NICHT abschneiden (führt zu falschen Ergebnissen)
        const text = isTOCQuery ? summary : summary.slice(0, env.estimateCharsPerDoc)
        
        // Budget-Prüfung: Für TOC-Queries Warnung statt Abbruch, sonst nur Warnung
        if (isTOCQuery) {
          // TOC-Query: Budget-Prüfung mit Warnung (kein Abschneiden, vollständiger Text wird verwendet)
          // Prüfe sowohl Zeichen- als auch Token-Budget
          const wouldExceedChars = !canAccumulate(usedChars, text.length, budgetChars)
          const wouldExceedTokens = budgetTokens ? !canAccumulateTokens(usedTokens, estimateTokensFromText(text), budgetTokens) : false
          
          if (wouldExceedChars || wouldExceedTokens) {
            // Budget überschritten: Warnung ausgeben, aber Text trotzdem verwenden (kein break)
            const exceededChars = wouldExceedChars ? `Zeichen-Budget überschritten (${usedChars + text.length}/${budgetChars})` : ''
            const exceededTokens = wouldExceedTokens && budgetTokens ? `Token-Budget überschritten (${usedTokens + estimateTokensFromText(text)}/${budgetTokens})` : ''
            const parts = [exceededChars, exceededTokens].filter(Boolean)
            if (parts.length > 0 && !budgetWarning) {
              budgetWarning = `⚠️ Budget-Warnung bei TOC-Query: ${parts.join(', ')}. Alle Dokumente werden trotzdem verwendet (kein Abschneiden).`
            }
          }
        } else {
          // Normale Query: Budget prüfen, aber nicht abbrechen (nur Warnung)
          void canAccumulate(usedChars, text.length, budgetChars)
          const est = budgetTokens ? estimateTokensFromText(text) : 0
          void (budgetTokens ? canAccumulateTokens(usedTokens, est, budgetTokens) : true)
        }
        
        sources.push({ 
          id: String(d.fileId ?? ''), 
          fileName: typeof d.fileName === 'string' ? d.fileName : undefined, 
          text,
          metadata: hasMetadata ? facetMetadata : undefined,
        })
        usedChars += text.length
        if (budgetTokens) usedTokens += estimateTokensFromText(text)
      } else if (mode === 'teaser') {
        // Teaser-Modus: Verwende teaser-Feld (kompakt)
        const doc = d as { teaser?: string }
        const teaser = doc.teaser || ''
        
        if (!teaser) continue
        
        // WICHTIG: Bei TOC-Queries NICHT abschneiden (führt zu falschen Ergebnissen)
        // Teaser ist bereits kompakt, daher immer vollständig verwenden
        const text = teaser
        
        // Budget-Prüfung: Für TOC-Queries Warnung statt Abbruch, sonst nur Warnung
        if (isTOCQuery) {
          // TOC-Query: Budget-Prüfung mit Warnung (kein Abschneiden, vollständiger Text wird verwendet)
          // Prüfe sowohl Zeichen- als auch Token-Budget
          const wouldExceedChars = !canAccumulate(usedChars, text.length, budgetChars)
          const wouldExceedTokens = budgetTokens ? !canAccumulateTokens(usedTokens, estimateTokensFromText(text), budgetTokens) : false
          
          if (wouldExceedChars || wouldExceedTokens) {
            // Budget überschritten: Warnung ausgeben, aber Text trotzdem verwenden (kein break)
            const exceededChars = wouldExceedChars ? `Zeichen-Budget überschritten (${usedChars + text.length}/${budgetChars})` : ''
            const exceededTokens = wouldExceedTokens && budgetTokens ? `Token-Budget überschritten (${usedTokens + estimateTokensFromText(text)}/${budgetTokens})` : ''
            const parts = [exceededChars, exceededTokens].filter(Boolean)
            if (parts.length > 0 && !budgetWarning) {
              budgetWarning = `⚠️ Budget-Warnung bei TOC-Query: ${parts.join(', ')}. Alle Dokumente werden trotzdem verwendet (kein Abschneiden).`
            }
          }
        } else {
          // Normale Query: Budget prüfen, aber nicht abbrechen (nur Warnung)
          void canAccumulate(usedChars, text.length, budgetChars)
          const est = budgetTokens ? estimateTokensFromText(text) : 0
          void (budgetTokens ? canAccumulateTokens(usedTokens, est, budgetTokens) : true)
        }
        
        sources.push({ 
          id: String(d.fileId ?? ''), 
          fileName: typeof d.fileName === 'string' ? d.fileName : undefined, 
          text,
          metadata: hasMetadata ? facetMetadata : undefined,
        })
        usedChars += text.length
        if (budgetTokens) usedTokens += estimateTokensFromText(text)
      }
    }
    stepList = markStepEnd({ ...stepList, topKReturned: sources.length })
    await logAppend(input.queryId, {
      indexName: VECTOR_SEARCH_INDEX_NAME,
      namespace: '',
      stage: 'list',
      level: 'summary',
      timingMs: stepList.timingMs,
      startedAt: stepList.startedAt,
      endedAt: stepList.endedAt,
      candidatesCount: items.length,
      usedInPrompt: sources.length,
      decision: mode,
      filtersEffective: {
        normalized: input.filters || {},
      },
    })

    return { 
      sources, 
      timing: { retrievalMs: Date.now() - t0 }, 
      stats: { candidatesCount: items.length, usedInPrompt: sources.length, decision: mode },
      warning: budgetWarning
    }
  }
}


