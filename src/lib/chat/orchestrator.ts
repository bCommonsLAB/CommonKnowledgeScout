import { buildPrompt } from '@/lib/chat/common/prompt'
import { callOpenAI, parseOpenAIResponse } from '@/lib/chat/common/llm'
import { getBaseBudget, reduceBudgets } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend, setPrompt as logSetPrompt, finalizeQueryLog } from '@/lib/logging/query-logger'
import type { RetrieverInput, RetrieverOutput } from '@/types/retriever'
import { summariesMongoRetriever } from '@/lib/chat/retrievers/summaries-mongo'
import { chunksRetriever } from '@/lib/chat/retrievers/chunks'

export interface OrchestratorInput extends RetrieverInput {
  retriever: 'chunk' | 'summary'
}

export async function runChatOrchestrated(run: OrchestratorInput): Promise<{ answer: string; sources: RetrieverOutput['sources']; retrievalMs: number; llmMs: number }> {
  const tR0 = Date.now()
  // Retriever wählen – vorerst nur summaries-mongo verfügbar; chunk folgt im nächsten Schritt
  const retrieverImpl = run.retriever === 'summary' ? summariesMongoRetriever : chunksRetriever

  const stepLevel = run.retriever === 'summary' ? 'summary' : 'chunk' as const
  // Hinweis: Summary-Flow loggt den list-Step bereits innerhalb des Retrievers mit candidatesCount/usedInPrompt/decision.
  // Für den Chunk-Flow behalten wir das Query-Logging hier bei.
  const { sources } = await retrieverImpl.retrieve(run)
  if (run.retriever !== 'summary') {
    let step = markStepStart({ indexName: run.context.vectorIndex, namespace: '', stage: 'query', level: stepLevel })
    step = markStepEnd(step)
    await logAppend(run.queryId, { indexName: run.context.vectorIndex, namespace: '', stage: 'query', level: stepLevel, topKReturned: sources.length, timingMs: step.timingMs, startedAt: step.startedAt, endedAt: step.endedAt })
  }

  const retrievalMs = Date.now() - tR0
  if (!sources || sources.length === 0) {
    await finalizeQueryLog(run.queryId, { answer: 'Keine passenden Inhalte gefunden', sources: [], timing: { retrievalMs, llmMs: 0, totalMs: retrievalMs } })
    return { answer: 'Keine passenden Inhalte gefunden', sources: [], retrievalMs, llmMs: 0 }
  }

  const prompt = buildPrompt(run.question, sources, run.answerLength)
  const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
  const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.3)
  const apiKey = process.env.OPENAI_API_KEY || ''
  await logSetPrompt(run.queryId, { provider: 'openai', model, temperature, prompt })

  const tL0 = Date.now()
  let res = await callOpenAI({ model, temperature, prompt, apiKey })
  if (!res.ok) {
    const text = await res.text()
    const tooLong = text.includes('maximum context length') || res.status === 400
    if (tooLong) {
      const budgets = reduceBudgets(run.answerLength)
      let retried = false
      for (const b of budgets) {
        const base = getBaseBudget(run.answerLength)
        if (b >= base) continue
        // trunc sources nach Budget b
        let acc = 0
        const reduced: typeof sources = []
        for (const s of sources) { const len = s.text?.length ?? 0; if (acc + len > b) break; reduced.push(s); acc += len }
        const p2 = buildPrompt(run.question, reduced, 'kurz')
        res = await callOpenAI({ model, temperature, prompt: p2, apiKey })
        if (res.ok) { retried = true; break }
      }
      if (!retried) throw new Error(`OpenAI Chat Fehler: ${res.status} ${text.slice(0, 200)}`)
    } else {
      throw new Error(`OpenAI Chat Fehler: ${res.status} ${text.slice(0, 200)}`)
    }
  }
  const raw = await res.text()
  const answer = await parseOpenAIResponse(raw)
  const llmMs = Date.now() - tL0

  await finalizeQueryLog(run.queryId, {
    answer,
    sources: sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score })),
    timing: { retrievalMs, llmMs, totalMs: undefined }
  })

  return { answer, sources, retrievalMs, llmMs }
}


