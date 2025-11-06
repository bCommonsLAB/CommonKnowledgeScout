import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'
import { getBaseBudget } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend } from '@/lib/logging/query-logger'
import { extractFacetMetadata } from './metadata-extractor'

export const chunksRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // Library-Context laden, um Facetten-Definitionen zu erhalten
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const ctx = await loadLibraryChatContext(input.userEmail || '', input.libraryId)
    const { parseFacetDefs } = await import('@/lib/chat/dynamic-facets')
    const facetDefs = ctx ? parseFacetDefs(ctx.library) : []

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')
    const idx = await describeIndex(input.context.vectorIndex, apiKey)
    if (!idx?.host) {
      throw new Error(
        `Index nicht gefunden: "${input.context.vectorIndex}". ` +
        `Bitte prüfe, ob der Index in Pinecone existiert oder ob der Index-Name in der Library-Konfiguration korrekt ist. ` +
        `Tipp: Verwende config.vectorStore.indexOverride in der Library-Konfiguration, um einen spezifischen Index-Namen festzulegen.`
      )
    }

    const budget = getBaseBudget(input.answerLength)
    const baseTopK = 20

    let stepEmbed = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'embed', level: 'question' })
    // Verwende Library-spezifischen API-Key für Embeddings, falls vorhanden
    const [qVec] = await embedTexts([input.question], undefined, input.apiKey)
    stepEmbed = markStepEnd(stepEmbed)
    await logAppend(input.queryId, { indexName: input.context.vectorIndex, namespace: '', stage: 'embed', level: 'question', timingMs: stepEmbed.timingMs, startedAt: stepEmbed.startedAt, endedAt: stepEmbed.endedAt })

    const chunkTask = (async () => {
      let s = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'query', level: 'chunk', filtersEffective: { pinecone: { ...input.filters } }, queryVectorInfo: { source: 'question' } })
      const res = await queryVectors(idx.host, apiKey, qVec, baseTopK, input.filters)
      s = markStepEnd({ ...s, topKRequested: baseTopK, topKReturned: res.length })
      return { matches: res, step: s }
    })()

    const summaryTask = (async () => {
      try {
        const flt = { ...(input.filters || {}), kind: { $eq: 'chapterSummary' } }
        let s = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'query', level: 'summary', filtersEffective: { pinecone: { ...flt } }, queryVectorInfo: { source: 'question' } })
        const res = await queryVectors(idx.host, apiKey, qVec, 10, flt)
        s = markStepEnd({ ...s, topKRequested: 10, topKReturned: res.length })
        return { chapterMatches: res, step: s }
      } catch {
        return { chapterMatches: [], step: undefined as unknown as ReturnType<typeof markStepStart> }
      }
    })()

    const [{ matches, step: stepQ }, { chapterMatches, step: stepC }] = await Promise.all([chunkTask, summaryTask])
    await logAppend(input.queryId, {
      indexName: input.context.vectorIndex,
      namespace: '',
      stage: 'query',
      level: 'chunk',
      topKRequested: baseTopK,
      topKReturned: matches.length,
      filtersEffective: { pinecone: { ...(input.filters || {}) } },
      queryVectorInfo: { source: 'question' },
      timingMs: stepQ.timingMs,
      startedAt: stepQ.startedAt,
      endedAt: stepQ.endedAt,
      results: matches.slice(0, 20).map(m => ({ id: m.id, type: 'chunk', score: m.score, metadata: m.metadata })),
    })
    if (Array.isArray(chapterMatches) && chapterMatches.length > 0) {
      await logAppend(input.queryId, {
        indexName: input.context.vectorIndex,
        namespace: '',
        stage: 'query',
        level: 'summary',
        topKRequested: 10,
        topKReturned: chapterMatches.length,
        filtersEffective: { pinecone: { ...(input.filters || {}), kind: { $eq: 'chapterSummary' } } },
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
        const meta = (m.metadata ?? {}) as Record<string, unknown>
        const chapterId = typeof (meta as { chapterId?: unknown }).chapterId === 'string' ? (meta as { chapterId: string }).chapterId : undefined
        if (!chapterId) return
        const score = base - i * step
        if (!chapterBoost.has(chapterId)) chapterBoost.set(chapterId, Math.max(0, score))
      })
    }

    const scoreMap = new Map<string, number>()
    for (const m of matches) scoreMap.set(m.id, typeof m.score === 'number' ? m.score : 0)

    const windowByLength = input.answerLength === 'ausführlich' ? 3 : input.answerLength === 'mittel' ? 2 : 1
    const parseId = (id: string) => { const idxDash = id.lastIndexOf('-'); if (idxDash < 0) return { base: id, chunk: NaN }; return { base: id.slice(0, idxDash), chunk: Number(id.slice(idxDash + 1)) } }
    const toId = (base: string, chunk: number) => `${base}-${chunk}`
    const idSet = new Set<string>()
    for (const m of matches) {
      const { base, chunk } = parseId(m.id)
      if (!Number.isFinite(chunk)) { idSet.add(m.id); continue }
      for (let d = -windowByLength; d <= windowByLength; d++) idSet.add(toId(base, chunk + d))
    }
    const ids = Array.from(idSet)
    let stepF = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'fetchNeighbors', level: 'chunk' })
    const fetched = await fetchVectors(idx.host, apiKey, ids)
    stepF = markStepEnd({ ...stepF, topKRequested: ids.length, topKReturned: Object.keys(fetched).length })
    await logAppend(input.queryId, { indexName: input.context.vectorIndex, namespace: '', stage: 'fetchNeighbors', level: 'chunk', topKRequested: ids.length, topKReturned: Object.keys(fetched).length, timingMs: stepF.timingMs, startedAt: stepF.startedAt, endedAt: stepF.endedAt })

    const chapterAlpha = Number(process.env.CHAT_CHAPTER_BOOST ?? 0.15)
    
    // FALLBACK: Wenn fetchNeighbors keine Ergebnisse liefert, verwende die ursprünglichen Matches
    // Die ursprünglichen Matches haben bereits metadata von der Query
    const fetchedCount = Object.keys(fetched).length
    const useOriginalMatches = fetchedCount === 0 && matches.length > 0
    
    const rows = useOriginalMatches
      ? // Fallback: Verwende die ursprünglichen Matches direkt
        matches.map(m => ({
          id: m.id,
          score: scoreMap.get(m.id) ?? (typeof m.score === 'number' ? m.score : 0),
          meta: m.metadata && typeof m.metadata === 'object' ? m.metadata as Record<string, unknown> : undefined
        }))
          .filter(r => r.meta)
          .map(r => {
            const meta = r.meta!
            const chapterId = typeof (meta as { chapterId?: unknown }).chapterId === 'string' ? (meta as { chapterId: string }).chapterId : undefined
            let boosted = r.score
            if (chapterId && chapterBoost.size > 0) {
              const b = chapterBoost.get(chapterId)
              if (typeof b === 'number') boosted = boosted + chapterAlpha * b
            }
            try {
              const q = input.question.toLowerCase()
              const title = typeof (meta as { chapterTitle?: unknown }).chapterTitle === 'string' ? (meta as { chapterTitle: string }).chapterTitle.toLowerCase() : ''
              const kws = Array.isArray((meta as { keywords?: unknown }).keywords) ? ((meta as { keywords: unknown[] }).keywords).filter(v => typeof v === 'string').map(v => String(v).toLowerCase()) : []
              let lex = 0
              if (title && q && title.includes(q)) lex += 0.02
              for (const kw of kws) if (kw && q.includes(kw)) { lex += 0.02; if (lex > 0.06) break }
              boosted += lex
            } catch {}
            return { ...r, score: boosted }
          })
          .sort((a, b) => (b.score - a.score))
      : // Normaler Flow: Verwende gefetchte Vektoren (inkl. Nachbarn)
        ids
          .map(id => {
            const maybe = (fetched as Record<string, unknown>)[id]
            const meta = maybe && typeof maybe === 'object' && 'metadata' in maybe ? (maybe as { metadata?: Record<string, unknown> }).metadata : undefined
            return { id, score: scoreMap.get(id) ?? 0, meta }
          })
          .filter(r => r.meta)
          .map(r => {
            const meta = r.meta!
            const chapterId = typeof (meta as { chapterId?: unknown }).chapterId === 'string' ? (meta as { chapterId: string }).chapterId : undefined
            let boosted = r.score
            if (chapterId && chapterBoost.size > 0) {
              const b = chapterBoost.get(chapterId)
              if (typeof b === 'number') boosted = boosted + chapterAlpha * b
            }
            try {
              const q = input.question.toLowerCase()
              const title = typeof (meta as { chapterTitle?: unknown }).chapterTitle === 'string' ? (meta as { chapterTitle: string }).chapterTitle.toLowerCase() : ''
              const kws = Array.isArray((meta as { keywords?: unknown }).keywords) ? ((meta as { keywords: unknown[] }).keywords).filter(v => typeof v === 'string').map(v => String(v).toLowerCase()) : []
              let lex = 0
              if (title && q && title.includes(q)) lex += 0.02
              for (const kw of kws) if (kw && q.includes(kw)) { lex += 0.02; if (lex > 0.06) break }
              boosted += lex
            } catch {}
            return { ...r, score: boosted }
          })
          .sort((a, b) => (b.score - a.score))

    const sources: RetrievedSource[] = []
    let used = 0
    for (const r of rows) {
      const meta = r.meta!
      const t = typeof (meta as { text?: unknown }).text === 'string' ? (meta as { text: string }).text : ''
      if (!t) continue
      const fileName = typeof (meta as { fileName?: unknown }).fileName === 'string' ? (meta as { fileName: string }).fileName : undefined
      const chunkIndex = typeof (meta as { chunkIndex?: unknown }).chunkIndex === 'number' ? (meta as { chunkIndex: number }).chunkIndex : undefined
      
      // Extrahiere fileId für Gruppierung
      let fileId = typeof (meta as { fileId?: unknown }).fileId === 'string' ? (meta as { fileId: string }).fileId : undefined
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
      const sourceType = typeof (meta as { sourceType?: unknown }).sourceType === 'string' 
        ? (meta as { sourceType: string }).sourceType as 'slides' | 'body' | 'video_transcript' | 'chapter'
        : undefined
      const slidePageNum = typeof (meta as { slidePageNum?: unknown }).slidePageNum === 'number' 
        ? (meta as { slidePageNum: number }).slidePageNum 
        : undefined
      const slideTitle = typeof (meta as { slideTitle?: unknown }).slideTitle === 'string' 
        ? (meta as { slideTitle: string }).slideTitle 
        : undefined
      const chapterTitle = typeof (meta as { chapterTitle?: unknown }).chapterTitle === 'string' 
        ? (meta as { chapterTitle: string }).chapterTitle 
        : undefined
      const chapterOrder = typeof (meta as { chapterOrder?: unknown }).chapterOrder === 'number' 
        ? (meta as { chapterOrder: number }).chapterOrder 
        : undefined
      
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
      if (used + t.length > budget) break
      sources.push(s)
      used += t.length
    }

    return { sources, timing: { retrievalMs: Date.now() - t0 } }
  }
}


