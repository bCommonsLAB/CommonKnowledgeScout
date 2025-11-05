import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { appendRetrievalStep as logAppend, markStepStart, markStepEnd } from '@/lib/logging/query-logger'
import { getBaseBudget, canAccumulate, getTokenBudget, estimateTokensFromText, canAccumulateTokens } from '@/lib/chat/common/budget'
import { extractFacetMetadata } from './metadata-extractor'

const env = {
  maxDocs: Number(process.env.SUMMARY_MAX_DOCS ?? 150),
  chaptersThreshold: Number(process.env.SUMMARY_CHAPTERS_THRESHOLD ?? 300),
  perDocChapterCap: Number(process.env.SUMMARY_PER_DOC_CHAPTER_CAP ?? 8),
  estimateCharsPerChapter: Number(process.env.SUMMARY_ESTIMATE_CHARS_PER_CHAPTER ?? 800),
  estimateCharsPerDoc: Number(process.env.SUMMARY_ESTIMATE_CHARS_PER_DOC ?? 1200),
}

function decideSummaryMode(docs: Array<{ chaptersCount?: number }>, budgetChars: number, isEventMode: boolean): 'chapters' | 'docs' {
  // KRITISCH: Im Event-Modus (Session) verwenden wir IMMER 'docs' Modus
  // Event-Dokumente haben keine Chapters, nur docMetaJson.summary
  if (isEventMode) return 'docs'
  
  const limitedDocs = docs.slice(0, env.maxDocs)
  const estChapters = limitedDocs
    .map(d => Math.min(Math.max(0, d.chaptersCount ?? 0), env.perDocChapterCap))
    .reduce((a, b) => a + b, 0)
  
  // KRITISCH: Wenn keine Chapters vorhanden sind, immer 'docs' Modus verwenden
  // (nutzt docMetaJson.summary statt chapters[].summary)
  if (estChapters === 0) return 'docs'
  
  const estCharsChapters = estChapters * env.estimateCharsPerChapter
  // estCharsDocs derzeit nicht benötigt
  // const estCharsDocs = limitedDocs.length * env.estimateCharsPerDoc
  if (estChapters <= env.chaptersThreshold && estCharsChapters <= budgetChars) return 'chapters'
  return 'docs'
}

export const summariesMongoRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // Library-Config laden, um zu prüfen, ob Event-Modus aktiv ist
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const ctx = await loadLibraryChatContext(input.userEmail || '', input.libraryId)
    const isEventMode = ctx?.chat.gallery.detailViewType === 'session'
    
    // Facetten-Definitionen laden für Metadaten-Extraktion
    const { parseFacetDefs } = await import('@/lib/chat/dynamic-facets')
    const facetDefs = ctx ? parseFacetDefs(ctx.library) : []
    
    // HINWEIS: Wir nutzen hier vorhandene Repos. findDocs liefert gefilterte Dokumente.
    // Dynamische Importe vermeiden Zyklen.
    const { computeDocMetaCollectionName, findDocSummaries } = await import('@/lib/repositories/doc-meta-repo')
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(input.userEmail || '', input.libraryId, strategy)

    // Logging: list(summary) Step öffnen
    let stepList = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'list', level: 'summary' })
    
    // Im Event-Modus keine Chapters laden (Performance-Optimierung)
    const items = await findDocSummaries(libraryKey, input.libraryId, input.filters, { 
      limit: env.maxDocs, 
      sort: { upsertedAt: -1 } 
    }, isEventMode)

    const budgetChars = getBaseBudget(input.answerLength)
    const budgetTokens = getTokenBudget()
    const mode = decideSummaryMode(items as Array<{ chaptersCount?: number }>, budgetChars, isEventMode)

    const sources: RetrievedSource[] = []
    let usedChars = 0
    let usedTokens = 0

    // IM SUMMARY-MODUS: Alle gefilterten Dokumente übernehmen (Budget-Limitierung optional)
    // Budget wird nur als Warnung verwendet, nicht als harte Grenze
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
          const text = `${title ? `Kapitel: ${title}\n` : ''}${sum.slice(0, env.estimateCharsPerChapter)}`
          // Im Summary-Modus: Budget prüfen, aber nicht abbrechen
          // Nur warnen, wenn Budget überschritten wird
          void canAccumulate(usedChars, text.length, budgetChars)
          const est = budgetTokens ? estimateTokensFromText(text) : 0
          void (budgetTokens ? canAccumulateTokens(usedTokens, est, budgetTokens) : true)
          // Warnung: Budget überschritten, aber trotzdem hinzufügen
          sources.push({ 
            id: String(d.fileId ?? ''), 
            fileName: typeof d.fileName === 'string' ? d.fileName : undefined, 
            text,
            metadata: hasMetadata ? facetMetadata : undefined,
          })
          usedChars += text.length
          if (budgetTokens) usedTokens += est
        }
      } else {
        const sum = typeof (d as { docSummary?: unknown }).docSummary === 'string' ? (d as { docSummary: string }).docSummary : ''
        if (!sum) continue
        const text = sum.slice(0, env.estimateCharsPerDoc)
        // Im Summary-Modus: Budget prüfen, aber nicht abbrechen
        // Alle Dokumente werden übernommen, Budget dient nur als Warnung
        void canAccumulate(usedChars, text.length, budgetChars)
        const est = budgetTokens ? estimateTokensFromText(text) : 0
        void (budgetTokens ? canAccumulateTokens(usedTokens, est, budgetTokens) : true)
        // Warnung: Budget überschritten, aber trotzdem hinzufügen
        sources.push({ 
          id: String(d.fileId ?? ''), 
          fileName: typeof d.fileName === 'string' ? d.fileName : undefined, 
          text,
          metadata: hasMetadata ? facetMetadata : undefined,
        })
        usedChars += text.length
        if (budgetTokens) usedTokens += est
      }
      // KEIN break mehr bei Budget-Überschreitung - alle Dokumente werden übernommen
    }
    stepList = markStepEnd({ ...stepList, topKReturned: sources.length })
    await logAppend(input.queryId, {
      indexName: input.context.vectorIndex,
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
        pinecone: input.filters || {}, // Für MongoDB-Retriever sind normalized und pinecone identisch
      },
    })

    return { sources, timing: { retrievalMs: Date.now() - t0 }, stats: { candidatesCount: items.length, usedInPrompt: sources.length, decision: mode } }
  }
}


