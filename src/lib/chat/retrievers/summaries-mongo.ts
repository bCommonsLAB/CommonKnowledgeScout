import type { ChatRetriever, RetrieverInput, RetrieverOutput, RetrievedSource } from '@/types/retriever'
import { appendRetrievalStep as logAppend, markStepStart, markStepEnd } from '@/lib/logging/query-logger'
import { getBaseBudget, canAccumulate } from '@/lib/chat/common/budget'

const env = {
  maxDocs: Number(process.env.SUMMARY_MAX_DOCS ?? 150),
  chaptersThreshold: Number(process.env.SUMMARY_CHAPTERS_THRESHOLD ?? 300),
  perDocChapterCap: Number(process.env.SUMMARY_PER_DOC_CHAPTER_CAP ?? 8),
  estimateCharsPerChapter: Number(process.env.SUMMARY_ESTIMATE_CHARS_PER_CHAPTER ?? 800),
  estimateCharsPerDoc: Number(process.env.SUMMARY_ESTIMATE_CHARS_PER_DOC ?? 1200),
}

function decideSummaryMode(docs: Array<{ chaptersCount?: number }>, budgetChars: number): 'chapters' | 'docs' {
  const limitedDocs = docs.slice(0, env.maxDocs)
  const estChapters = limitedDocs
    .map(d => Math.min(Math.max(0, d.chaptersCount ?? 0), env.perDocChapterCap))
    .reduce((a, b) => a + b, 0)
  const estCharsChapters = estChapters * env.estimateCharsPerChapter
  const estCharsDocs = limitedDocs.length * env.estimateCharsPerDoc
  if (estChapters <= env.chaptersThreshold && estCharsChapters <= budgetChars) return 'chapters'
  return 'docs'
}

export const summariesMongoRetriever: ChatRetriever = {
  async retrieve(input: RetrieverInput): Promise<RetrieverOutput> {
    const t0 = Date.now()

    // HINWEIS: Wir nutzen hier vorhandene Repos. findDocs liefert gefilterte Dokumente.
    // Dynamische Importe vermeiden Zyklen.
    const { computeDocMetaCollectionName, findDocSummaries } = await import('@/lib/repositories/doc-meta-repo')
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(input.userEmail || '', input.libraryId, strategy)

    // Logging: list(summary) Step öffnen
    let stepList = markStepStart({ indexName: input.context.vectorIndex, namespace: '', stage: 'list', level: 'summary' })
    const items = await findDocSummaries(libraryKey, input.libraryId, input.filters, { limit: env.maxDocs, sort: { upsertedAt: -1 } })

    const budget = getBaseBudget(input.answerLength)
    const mode = decideSummaryMode(items as Array<{ chaptersCount?: number }>, budget)

    const sources: RetrievedSource[] = []
    let used = 0

    for (const d of items) {
      if (mode === 'chapters') {
        const ch = Array.isArray(d.chapters) ? d.chapters.slice(0, env.perDocChapterCap) : []
        for (const c of ch) {
          const title = typeof c?.title === 'string' ? c.title : undefined
          const sum = typeof c?.summary === 'string' ? c.summary : undefined
          if (!sum) continue
          const text = `${title ? `Kapitel: ${title}\n` : ''}${sum.slice(0, env.estimateCharsPerChapter)}`
          if (!canAccumulate(used, text.length, budget)) { break }
          sources.push({ id: String(d.fileId ?? ''), fileName: typeof d.fileName === 'string' ? d.fileName : undefined, text })
          used += text.length
        }
      } else {
        const sum = typeof (d as any).docSummary === 'string' ? String((d as any).docSummary) : ''
        if (!sum) continue
        const text = sum.slice(0, env.estimateCharsPerDoc)
        if (!canAccumulate(used, text.length, budget)) break
        sources.push({ id: String(d.fileId ?? ''), fileName: typeof d.fileName === 'string' ? d.fileName : undefined, text })
        used += text.length
      }
      if (used >= budget) break
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
    })

    return { sources, timing: { retrievalMs: Date.now() - t0 } }
  }
}


