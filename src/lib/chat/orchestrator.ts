/**
 * @fileoverview Chat Orchestrator - Coordinates Chat Response Generation
 * 
 * @description
 * Orchestrates the complete chat response generation process including retrieval,
 * prompt building, LLM calls, and response parsing. Handles both regular chat queries
 * and TOC (Table of Contents) queries for story mode. Manages retriever selection,
 * source filtering, and error handling.
 * 
 * @module chat
 * 
 * @exports
 * - runChatOrchestrated: Main orchestration function
 * - OrchestratorInput: Input interface for orchestration
 * - OrchestratorOutput: Output interface for orchestration results
 * 
 * @usedIn
 * - src/app/api/chat/[libraryId]/stream/route.ts: Chat streaming endpoint uses orchestrator
 * - src/lib/chat/loader.ts: Chat loader may use orchestrator
 * 
 * @dependencies
 * - @/lib/chat/common/prompt: Prompt building utilities
 * - @/lib/chat/common/llm: LLM calling utilities
 * - @/lib/chat/retrievers/summaries-mongo: Summary retriever
 * - @/lib/chat/retrievers/chunks: Chunk retriever
 * - @/lib/logging/query-logger: Query logging utilities
 * - @/types/retriever: Retriever types
 * - @/types/chat-response: Chat response types
 */

import { buildPrompt, buildTOCPrompt, getSourceDescription } from '@/lib/chat/common/prompt'
import { callOpenAI, parseStructuredLLMResponse, parseOpenAIResponseWithUsage } from '@/lib/chat/common/llm'
import { parseStoryTopicsData } from '@/lib/chat/common/toc-parser'
import { getBaseBudget, reduceBudgets } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend, setPrompt as logSetPrompt, finalizeQueryLog } from '@/lib/logging/query-logger'
import type { RetrieverInput, RetrieverOutput } from '@/types/retriever'
import { summariesMongoRetriever } from '@/lib/chat/retrievers/summaries-mongo'
import { chunksRetriever } from '@/lib/chat/retrievers/chunks'
import type { ChatResponse } from '@/types/chat-response'
import type { NormalizedChatConfig } from '@/lib/chat/config'
import type { StoryTopicsData } from '@/types/story-topics'

export interface OrchestratorInput extends RetrieverInput {
  retriever: 'chunk' | 'summary'
  chatConfig?: NormalizedChatConfig
  chatHistory?: Array<{ question: string; answer: string }>
  facetsSelected?: Record<string, unknown>  // Facetten-Filter für Prompt
  facetDefs?: Array<{ metaKey: string; label?: string; type: string }>  // Facetten-Definitionen für Prompt
  onStatusUpdate?: (message: string) => void
  onProcessingStep?: (step: import('@/types/chat-processing').ChatProcessingStep) => void
  apiKey?: string  // Optional: API-Key für öffentliche Libraries
  isTOCQuery?: boolean  // Wenn true, verwende TOC-Prompt und parse StoryTopicsData
  // libraryId ist bereits in RetrieverInput enthalten (required)
}

export interface OrchestratorOutput {
  answer: string
  sources: RetrieverOutput['sources']
  references: ChatResponse['references']
  suggestedQuestions: string[]
  retrievalMs: number
  llmMs: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  storyTopicsData?: StoryTopicsData  // Für TOC-Queries: Strukturierte Themenübersicht
}

export async function runChatOrchestrated(run: OrchestratorInput): Promise<OrchestratorOutput> {
  const tR0 = Date.now()
  // Retriever wählen – vorerst nur summaries-mongo verfügbar; chunk folgt im nächsten Schritt
  const retrieverImpl = run.retriever === 'summary' ? summariesMongoRetriever : chunksRetriever

  const stepLevel = run.retriever === 'summary' ? 'summary' : 'chunk' as const
  // Note: Summary flow logs the list-step already within the retriever with candidatesCount/usedInPrompt/decision.
  // For chunk flow, we keep the query logging here.
  run.onStatusUpdate?.('Searching for relevant sources...')
  // Pass API key to retriever for embeddings (if available)
  const { sources, stats } = await retrieverImpl.retrieve({ ...run, apiKey: run.apiKey })
  run.onStatusUpdate?.(`${sources.length} sources found`)
  if (run.retriever !== 'summary') {
    let step = markStepStart({ indexName: run.context.vectorIndex, namespace: '', stage: 'query', level: stepLevel })
    step = markStepEnd(step)
    await logAppend(run.queryId, { indexName: run.context.vectorIndex, namespace: '', stage: 'query', level: stepLevel, topKReturned: sources.length, timingMs: step.timingMs, startedAt: step.startedAt, endedAt: step.endedAt })
  }

  const retrievalMs = Date.now() - tR0
  if (!sources || sources.length === 0) {
    await finalizeQueryLog(run.queryId, { answer: 'No matching content found', sources: [], timing: { retrievalMs, llmMs: 0, totalMs: retrievalMs } })
    return { answer: 'No matching content found', sources: [], references: [], suggestedQuestions: [], retrievalMs, llmMs: 0 }
  }

  // Sende retrieval_complete direkt nach dem Retrieval
  run.onProcessingStep?.({
    type: 'retrieval_complete',
    sourcesCount: sources.length,
    timingMs: retrievalMs,
  })

  const promptAnswerLength = (run.answerLength === 'unbegrenzt' ? 'ausführlich' : run.answerLength)
  run.onStatusUpdate?.('Building prompt...')
  
  // Für TOC-Queries: Verwende speziellen TOC-Prompt
  let prompt: string
  if (run.isTOCQuery && run.libraryId) {
    prompt = buildTOCPrompt(run.libraryId, sources, {
      targetLanguage: run.chatConfig?.targetLanguage,
      character: run.chatConfig?.character,
      socialContext: run.chatConfig?.socialContext,
      genderInclusive: run.chatConfig?.genderInclusive,
      filters: run.facetsSelected,
      facetDefs: run.facetDefs,
    })
  } else {
    prompt = buildPrompt(run.question, sources, promptAnswerLength, {
      targetLanguage: run.chatConfig?.targetLanguage,
      character: run.chatConfig?.character,
      socialContext: run.chatConfig?.socialContext,
      genderInclusive: run.chatConfig?.genderInclusive,
      chatHistory: run.chatHistory,
      filters: run.facetsSelected,
      facetDefs: run.facetDefs,
    })
  }
  // Note only for chunk mode: In summary mode, all documents are included
  if (run.retriever !== 'summary' && stats && typeof stats.candidatesCount === 'number' && typeof stats.usedInPrompt === 'number' && stats.usedInPrompt < stats.candidatesCount) {
    const hint = `\n\nNote: Due to space constraints, only ${stats.usedInPrompt} of ${stats.candidatesCount} matching documents could be considered.`
    prompt = prompt + hint
  }
  const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
  const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.3)
  // Verwende publicApiKey wenn vorhanden, sonst globalen API-Key
  const apiKey = run.apiKey || process.env.OPENAI_API_KEY || ''
  await logSetPrompt(run.queryId, { provider: 'openai', model, temperature, prompt })
  
  // Sende prompt_complete direkt nach dem Prompt-Building
  const { estimateTokensFromText } = await import('@/lib/chat/common/budget')
  run.onProcessingStep?.({
    type: 'prompt_complete',
    promptLength: prompt.length,
    documentsUsed: sources.length,
    tokenCount: estimateTokensFromText(prompt),
  })

  const tL0 = Date.now()
  run.onStatusUpdate?.('Generating answer...')
  let res = await callOpenAI({ model, temperature, prompt, apiKey })
  let raw = ''
  let promptTokens: number | undefined = undefined
  let completionTokens: number | undefined = undefined
  let totalTokens: number | undefined = undefined
  
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
        const p2 = run.isTOCQuery && run.libraryId
          ? buildTOCPrompt(run.libraryId, reduced, {
              targetLanguage: run.chatConfig?.targetLanguage,
              character: run.chatConfig?.character,
              socialContext: run.chatConfig?.socialContext,
              genderInclusive: run.chatConfig?.genderInclusive,
              filters: run.facetsSelected,
              facetDefs: run.facetDefs,
            })
          : buildPrompt(run.question, reduced, 'kurz', {
              targetLanguage: run.chatConfig?.targetLanguage,
              character: run.chatConfig?.character,
              socialContext: run.chatConfig?.socialContext,
              genderInclusive: run.chatConfig?.genderInclusive,
              chatHistory: run.chatHistory,
              filters: run.facetsSelected,
              facetDefs: run.facetDefs,
            })
        res = await callOpenAI({ model, temperature, prompt: p2, apiKey })
        if (res.ok) { 
          retried = true
          const result = await parseOpenAIResponseWithUsage(res)
          raw = result.raw
          promptTokens = result.promptTokens
          completionTokens = result.completionTokens
          totalTokens = result.totalTokens
          break 
        }
      }
      if (!retried) throw new Error(`OpenAI Chat Fehler: ${res.status} ${text.slice(0, 200)}`)
    } else {
      throw new Error(`OpenAI Chat Fehler: ${res.status} ${text.slice(0, 200)}`)
    }
  } else {
    const result = await parseOpenAIResponseWithUsage(res)
    raw = result.raw
    promptTokens = result.promptTokens
    completionTokens = result.completionTokens
    totalTokens = result.totalTokens
  }
  
  // Parse structured response (answer, suggestedQuestions, usedReferences)
  // For TOC queries: Parse StoryTopicsData instead of normal answer
  run.onStatusUpdate?.('Processing response...')
  let answer = ''
  let suggestedQuestions: string[] = []
  let usedReferences: number[] = []
  let storyTopicsData: StoryTopicsData | undefined = undefined

  if (run.isTOCQuery) {
    // For TOC queries: Try to parse StoryTopicsData
    console.log('[Orchestrator] TOC query detected, attempting to parse StoryTopicsData. Raw length:', raw.length)
    console.log('[Orchestrator] Raw (first 500 characters):', raw.substring(0, 500))
    const parsedTopicsData = parseStoryTopicsData(raw)
    if (parsedTopicsData) {
      console.log('[Orchestrator] ✅ StoryTopicsData successfully parsed:', {
        title: parsedTopicsData.title,
        topicsCount: parsedTopicsData.topics.length,
      })
      storyTopicsData = parsedTopicsData
      // Create a Markdown answer from StoryTopicsData for the normal answer
      // (for backward compatibility)
      answer = `# ${parsedTopicsData.title}\n\n${parsedTopicsData.tagline}\n\n${parsedTopicsData.intro}\n\n`
      parsedTopicsData.topics.forEach((topic) => {
        answer += `## ${topic.title}\n\n`
        if (topic.summary) {
          answer += `${topic.summary}\n\n`
        }
        topic.questions.forEach((q, qIndex) => {
          answer += `${qIndex + 1}. ${q.text}\n`
        })
        answer += '\n'
      })
      // Generate suggestedQuestions from topics
      suggestedQuestions = parsedTopicsData.topics.flatMap(topic => 
        topic.questions.map(q => q.text)
      ).slice(0, 7) // Limit to 7 questions
    } else {
      console.error('[Orchestrator] ❌ StoryTopicsData parsing failed. Raw length:', raw.length)
      console.error('[Orchestrator] Raw (first 1000 characters):', raw.substring(0, 1000))
      // Fallback: Parse normal answer
      const parsed = parseStructuredLLMResponse(raw)
      answer = parsed.answer
      suggestedQuestions = parsed.suggestedQuestions
      usedReferences = parsed.usedReferences
    }
  } else {
    // Normal queries: Standard parsing
    const parsed = parseStructuredLLMResponse(raw)
    answer = parsed.answer
    suggestedQuestions = parsed.suggestedQuestions
    usedReferences = parsed.usedReferences
  }
  
  const llmMs = Date.now() - tL0
  
  // Sende llm_complete direkt nach dem LLM-Aufruf
  run.onProcessingStep?.({
    type: 'llm_complete',
    timingMs: llmMs,
    promptTokens,
    completionTokens,
    totalTokens,
  })

  // Generate complete references list from sources (for mapping)
  const allReferences: ChatResponse['references'] = sources.map((s, index) => {
    const fileId = s.fileId || s.id.split('-')[0]
    return {
      number: index + 1,
      fileId,
      fileName: s.fileName,
      description: getSourceDescription(s),
    }
  })
  
  // Filter only the actually used references from usedReferences
  const references: ChatResponse['references'] = usedReferences.length > 0
    ? allReferences.filter(ref => usedReferences.includes(ref.number))
    : allReferences // Fallback: If none found, show all

  await finalizeQueryLog(run.queryId, {
    answer,
    sources: sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score })),
    references,
    suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : [],
    timing: { retrievalMs, llmMs, totalMs: undefined },
    tokenUsage: promptTokens !== undefined || completionTokens !== undefined || totalTokens !== undefined
      ? { promptTokens, completionTokens, totalTokens }
      : undefined,
    storyTopicsData,
  })

  return { 
    answer, 
    sources, 
    references, 
    suggestedQuestions, 
    retrievalMs, 
    llmMs, 
    promptTokens, 
    completionTokens, 
    totalTokens,
    storyTopicsData 
  }
}


