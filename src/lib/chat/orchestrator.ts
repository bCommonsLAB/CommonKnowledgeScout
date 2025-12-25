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

import { getSourceDescription, buildChatMessages, buildTOCMessages } from '@/lib/chat/common/prompt'
import { callLlmJson, getLlmProviderForLogging } from '@/lib/chat/common/llm'
import { chatAnswerSchemaJson, chatAnswerZodSchema, storyTopicsSchemaJson, storyTopicsZodSchema } from '@/lib/chat/common/structured-schemas'
import { normalizeSuggestedQuestionsToSeven } from '@/lib/chat/common/normalize-suggested-questions'
import { getSecretaryConfig } from '@/lib/env'
import { getBaseBudget, reduceBudgets } from '@/lib/chat/common/budget'
import { markStepStart, markStepEnd, appendRetrievalStep as logAppend, setPrompt as logSetPrompt, finalizeQueryLog } from '@/lib/logging/query-logger'
import type { RetrieverInput, RetrieverOutput } from '@/types/retriever'
import { summariesMongoRetriever } from '@/lib/chat/retrievers/summaries-mongo'
import { chunksRetriever } from '@/lib/chat/retrievers/chunks'
import { chunkSummaryRetriever } from '@/lib/chat/retrievers/chunk-summary'
import type { ChatResponse } from '@/types/chat-response'
import type { NormalizedChatConfig } from '@/lib/chat/config'
import type { StoryTopicsData } from '@/types/story-topics'

export interface OrchestratorInput extends RetrieverInput {
  retriever: 'chunk' | 'chunkSummary' | 'summary'
  chatConfig?: NormalizedChatConfig
  chatHistory?: Array<{ question: string; answer: string }>
  facetsSelected?: Record<string, unknown>  // Facetten-Filter für Prompt
  facetDefs?: Array<{ metaKey: string; label?: string; type: string }>  // Facetten-Definitionen für Prompt
  onProcessingStep?: (step: import('@/types/chat-processing').ChatProcessingStep) => void
  apiKey?: string  // Optional: API-Key für öffentliche Libraries
  isTOCQuery?: boolean  // Wenn true, verwende TOC-Prompt und parse StoryTopicsData
  uiLocale?: string  // UI-Locale für 'global' targetLanguage (z.B. 'de', 'fr', 'en')
  llmModel?: string  // Optional: LLM-Modell-ID (z.B. 'google/gemini-2.5-flash')
  temperature?: number  // Optional: Temperature für LLM (default: 0.3)
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
  // Retriever wählen: summary, chunkSummary oder chunk (RAG)
  const retrieverImpl = run.retriever === 'summary' 
    ? summariesMongoRetriever 
    : run.retriever === 'chunkSummary'
    ? chunkSummaryRetriever
    : chunksRetriever

  const stepLevel = run.retriever === 'summary' 
    ? 'summary' 
    : run.retriever === 'chunkSummary'
    ? 'chunkSummary'
    : 'chunk' as const
  // Note: Summary flow logs the list-step already within the retriever with candidatesCount/usedInPrompt/decision.
  // For chunk flow, we keep the query logging here.
  run.onProcessingStep?.({ type: 'retrieval_progress', sourcesFound: 0, message: 'Searching for relevant sources...' })
  // Pass API key to retriever for embeddings (if available)
  const retrieverOutput = await retrieverImpl.retrieve({ ...run, apiKey: run.apiKey })
  const { sources, stats, warning } = retrieverOutput
  
  // User-Status-Update mit Mode-Information (für Summary-Retriever)
  if (run.retriever === 'summary' && stats?.decision) {
    const modeLabel = stats.decision === 'chapters' ? 'Kapitel-Summaries' 
      : stats.decision === 'teaser' ? 'Teaser' 
      : 'Dokument-Summaries'
    run.onProcessingStep?.({ type: 'retrieval_progress', sourcesFound: sources.length, message: `${sources.length} Quellen gefunden (${modeLabel})` })
  } else {
    run.onProcessingStep?.({ type: 'retrieval_progress', sourcesFound: sources.length, message: `${sources.length} sources found` })
  }
  // Note: Summary und chunkSummary flow loggen den list-step bereits innerhalb des Retrievers
  // Nur chunk (RAG) flow loggt hier zusätzlich
  if (run.retriever === 'chunk') {
    const { VECTOR_SEARCH_INDEX_NAME } = await import('@/lib/chat/vector-search-index')
    let step = markStepStart({ indexName: VECTOR_SEARCH_INDEX_NAME, namespace: '', stage: 'query', level: stepLevel })
    step = markStepEnd(step)
    await logAppend(run.queryId, { indexName: VECTOR_SEARCH_INDEX_NAME, namespace: '', stage: 'query', level: stepLevel, topKReturned: sources.length, timingMs: step.timingMs, startedAt: step.startedAt, endedAt: step.endedAt })
  }

  const retrievalMs = Date.now() - tR0
  if (!sources || sources.length === 0) {
    await finalizeQueryLog(run.queryId, { answer: 'No matching content found', sources: [], timing: { retrievalMs, llmMs: 0, totalMs: retrievalMs } })
    return { answer: 'No matching content found', sources: [], references: [], suggestedQuestions: [], retrievalMs, llmMs: 0 }
  }

  // Berechne Anzahl unterschiedlicher fileIds
  const uniqueFileIds = new Set<string>()
  for (const source of sources) {
    if (source.fileId && typeof source.fileId === 'string') {
      uniqueFileIds.add(source.fileId)
    }
  }

  // Sende retrieval_complete direkt nach dem Retrieval
  // Füge summaryMode hinzu, wenn Retriever 'summary' ist
  const summaryMode = run.retriever === 'summary' && retrieverOutput.stats?.decision 
    ? retrieverOutput.stats.decision 
    : undefined
  
  // Extrahiere zusätzliche Stats für Chunk-Retriever
  const chunkStats = run.retriever === 'chunk' ? {
    initialMatches: retrieverOutput.stats?.initialMatches,
    neighborsAdded: retrieverOutput.stats?.neighborsAdded,
    topKRequested: retrieverOutput.stats?.topKRequested,
    budgetUsed: retrieverOutput.stats?.budgetUsed,
    answerLength: retrieverOutput.stats?.answerLength,
  } : {}
  
  run.onProcessingStep?.({
    type: 'retrieval_complete',
    sourcesCount: sources.length,
    uniqueFileIdsCount: uniqueFileIds.size > 0 ? uniqueFileIds.size : undefined,
    timingMs: retrievalMs,
    summaryMode,
    ...chunkStats,
  })

  // Verwende answerLength direkt (nicht mehr konvertieren, damit unbegrenzt auch wirklich unbegrenzt bleibt)
  run.onProcessingStep?.({ type: 'prompt_building', message: 'Building prompt...' })
  
  // LLM-Modell muss explizit gesetzt sein (deterministisch, kein Fallback)
  if (!run.llmModel) {
    throw new Error('llmModel ist erforderlich für Chat-Orchestrierung')
  }
  const model = run.llmModel
  const temperature = run.temperature ?? 0.3
  
  // Verwende publicApiKey wenn vorhanden, sonst Secretary Service API-Key
  const { apiKey: configApiKey } = getSecretaryConfig()
  const apiKey = run.apiKey || configApiKey || ''
  const providerForLogging = getLlmProviderForLogging()
  
  // Erstelle Messages-Array (System + History + User)
  let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  let promptForLogging: string
  
  if (run.isTOCQuery && run.libraryId) {
    // TOC: Verwende buildTOCMessages
    messages = buildTOCMessages(run.libraryId, sources, {
      targetLanguage: run.chatConfig?.targetLanguage,
      character: run.chatConfig?.character,
      accessPerspective: run.chatConfig?.accessPerspective,
      socialContext: run.chatConfig?.socialContext,
      genderInclusive: run.chatConfig?.genderInclusive,
      filters: run.facetsSelected,
      facetDefs: run.facetDefs,
      uiLocale: run.uiLocale,
    })
    // Für Logging: Konvertiere Messages zu String
    promptForLogging = messages.map(m => `${m.role}: ${m.content}`).join('\n\n---\n\n')
  } else {
    // Chat: Verwende buildChatMessages
    messages = buildChatMessages(run.question, sources, run.answerLength, {
      targetLanguage: run.chatConfig?.targetLanguage,
      character: run.chatConfig?.character,
      accessPerspective: run.chatConfig?.accessPerspective,
      socialContext: run.chatConfig?.socialContext,
      genderInclusive: run.chatConfig?.genderInclusive,
      chatHistory: run.chatHistory,
      filters: run.facetsSelected,
      facetDefs: run.facetDefs,
      uiLocale: run.uiLocale,
      candidatesCount: stats?.candidatesCount,
      usedInPrompt: stats?.usedInPrompt,
    })
    // Für Logging: Konvertiere Messages zu String
    promptForLogging = messages.map(m => `${m.role}: ${m.content}`).join('\n\n---\n\n')
  }
  
  await logSetPrompt(run.queryId, { provider: providerForLogging, model, temperature, prompt: promptForLogging })
  
  // Sende prompt_complete direkt nach dem Prompt-Building
  const { estimateTokensFromText } = await import('@/lib/chat/common/budget')
  const totalPromptLength = messages.reduce((sum, m) => sum + m.content.length, 0)
  run.onProcessingStep?.({
    type: 'prompt_complete',
    promptLength: totalPromptLength,
    documentsUsed: sources.length,
    tokenCount: estimateTokensFromText(promptForLogging),
  })

  const tL0 = Date.now()
  run.onProcessingStep?.({ type: 'llm_progress', message: 'Generating answer...' })
  
  // Für unbegrenzt Modus: Setze max_tokens auf hohen Wert (gpt-4.1-mini: 32k max output tokens)
  // Bei vielen Chunks sollte die Antwort entsprechend lang sein
  const maxTokens = run.answerLength === 'unbegrenzt' 
    ? Math.min(32000, Math.max(16000, Math.floor(sources.length * 20))) // Mindestens 16k, max 32k, skaliert mit Anzahl der Chunks
    : undefined
  
  let promptTokens: number | undefined = undefined
  let completionTokens: number | undefined = undefined
  let totalTokens: number | undefined = undefined
  let answer = ''
  let suggestedQuestions: string[] = []
  let usedReferences: number[] = []
  let storyTopicsData: StoryTopicsData | undefined = undefined
  
  try {
    if (run.isTOCQuery && run.libraryId) {
      // TOC: Verwende callLlmJson mit storyTopicsSchema
      const result = await callLlmJson(
        {
          apiKey,
          model,
          temperature,
          responseFormat: { type: 'json_object' },
          messages,
          maxTokens,
        },
        storyTopicsZodSchema,
        storyTopicsSchemaJson
      )
      
      storyTopicsData = result.data
      promptTokens = result.usage?.promptTokens
      completionTokens = result.usage?.completionTokens
      totalTokens = result.usage?.totalTokens
      
      // Create a Markdown answer from StoryTopicsData for the normal answer (for backward compatibility)
      answer = `# ${storyTopicsData.title}\n\n${storyTopicsData.tagline}\n\n${storyTopicsData.intro}\n\n`
      storyTopicsData.topics.forEach((topic) => {
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
      suggestedQuestions = storyTopicsData.topics.flatMap(topic => 
        topic.questions.map(q => q.text)
      ).slice(0, 7) // Limit to 7 questions
    } else {
      // Chat: Verwende callLlmJson mit chatAnswerSchema
      const result = await callLlmJson(
        {
          apiKey,
          model,
          temperature,
          responseFormat: { type: 'json_object' },
          messages,
          maxTokens,
        },
        chatAnswerZodSchema,
        chatAnswerSchemaJson
      )
      
      answer = result.data.answer
      // suggestedQuestions sind UX-orientiert: immer auf genau 7 normalisieren, um die UI stabil zu halten.
      suggestedQuestions = normalizeSuggestedQuestionsToSeven({
        suggestedQuestions: result.data.suggestedQuestions,
        seedQuestion: run.question,
      })
      usedReferences = result.data.usedReferences ?? []
      promptTokens = result.usage?.promptTokens
      completionTokens = result.usage?.completionTokens
      totalTokens = result.usage?.totalTokens
      
      // Optional: Konsistenz-Check für References
      // Extrahiere zitierten References aus answer per Regex
      const citedRefs = new Set<number>()
      const citationRegex = /\[(\d+)\]/g
      let match: RegExpExecArray | null
      while ((match = citationRegex.exec(answer)) !== null) {
        const refNum = parseInt(match[1], 10)
        if (refNum > 0) {
          citedRefs.add(refNum)
        }
      }
      
      // Normalisiere usedReferences (sortiert, unique)
      const normalizedUsedRefs = [...new Set(usedReferences)].sort((a, b) => a - b)
      
      // Wenn citedRefs vorhanden sind, aber nicht mit usedReferences übereinstimmen, logge Warnung
      if (citedRefs.size > 0 && normalizedUsedRefs.length > 0) {
        const citedArray = [...citedRefs].sort((a, b) => a - b)
        const refsMatch = citedArray.length === normalizedUsedRefs.length && 
          citedArray.every((val, idx) => val === normalizedUsedRefs[idx])
        if (!refsMatch) {
          console.warn('[Orchestrator] Reference mismatch:', {
            citedInAnswer: citedArray,
            reportedInUsedReferences: normalizedUsedRefs,
          })
          // Verwende citedRefs als Fallback, wenn usedReferences leer oder deutlich abweichend
          if (normalizedUsedRefs.length === 0 || Math.abs(citedArray.length - normalizedUsedRefs.length) > 2) {
            usedReferences = citedArray
          }
        } else {
          usedReferences = normalizedUsedRefs
        }
      } else {
        usedReferences = normalizedUsedRefs
      }
    }
  } catch (error) {
    // Importiere LlmProviderError für bessere Fehlerbehandlung
    const { LlmProviderError } = await import('@/lib/chat/common/llm')
    
    const errorMessage = error instanceof Error ? error.message : 'LLM Chat Fehler'
    const statusCode = error instanceof LlmProviderError ? error.statusCode : undefined
    
    // Prüfe auf "too long" Fehler (kann bei verschiedenen Providern unterschiedlich formuliert sein)
    const tooLong = errorMessage.includes('maximum context length') 
      || errorMessage.includes('400')
      || errorMessage.includes('context length')
      || (statusCode === 400 && errorMessage.includes('token'))
    
    if (tooLong) {
      // Retry mit reduzierten Quellen
      const budgets = reduceBudgets(run.answerLength)
      let retried = false
      for (const b of budgets) {
        const base = getBaseBudget(run.answerLength)
        if (b >= base) continue
        // trunc sources nach Budget b
        let acc = 0
        const reduced: typeof sources = []
        for (const s of sources) { const len = s.text?.length ?? 0; if (acc + len > b) break; reduced.push(s); acc += len }
        
        // Erstelle reduzierte Messages
        const reducedMessages = run.isTOCQuery && run.libraryId
          ? buildTOCMessages(run.libraryId, reduced, {
              targetLanguage: run.chatConfig?.targetLanguage,
              character: run.chatConfig?.character,
              accessPerspective: run.chatConfig?.accessPerspective,
              socialContext: run.chatConfig?.socialContext,
              genderInclusive: run.chatConfig?.genderInclusive,
              filters: run.facetsSelected,
              facetDefs: run.facetDefs,
            })
          : buildChatMessages(run.question, reduced, 'kurz', {
              targetLanguage: run.chatConfig?.targetLanguage,
              character: run.chatConfig?.character,
              accessPerspective: run.chatConfig?.accessPerspective,
              socialContext: run.chatConfig?.socialContext,
              genderInclusive: run.chatConfig?.genderInclusive,
              chatHistory: run.chatHistory,
              filters: run.facetsSelected,
              facetDefs: run.facetDefs,
            })
        
        // Bei Retry mit reduzierten Quellen: Kein maxTokens (verwende Standard)
        try {
          if (run.isTOCQuery && run.libraryId) {
            const retryResult = await callLlmJson(
              {
                apiKey,
                model,
                temperature,
                responseFormat: { type: 'json_object' },
                messages: reducedMessages,
              },
              storyTopicsZodSchema,
              storyTopicsSchemaJson
            )
            storyTopicsData = retryResult.data
            promptTokens = retryResult.usage?.promptTokens
            completionTokens = retryResult.usage?.completionTokens
            totalTokens = retryResult.usage?.totalTokens
            
            // Create Markdown answer
            answer = `# ${storyTopicsData.title}\n\n${storyTopicsData.tagline}\n\n${storyTopicsData.intro}\n\n`
            storyTopicsData.topics.forEach((topic) => {
              answer += `## ${topic.title}\n\n`
              if (topic.summary) {
                answer += `${topic.summary}\n\n`
              }
              topic.questions.forEach((q, qIndex) => {
                answer += `${qIndex + 1}. ${q.text}\n`
              })
              answer += '\n'
            })
            suggestedQuestions = storyTopicsData.topics.flatMap(topic => 
              topic.questions.map(q => q.text)
            ).slice(0, 7)
          } else {
            const retryResult = await callLlmJson(
              {
                apiKey,
                model,
                temperature,
                responseFormat: { type: 'json_object' },
                messages: reducedMessages,
              },
              chatAnswerZodSchema,
              chatAnswerSchemaJson
            )
            answer = retryResult.data.answer
            suggestedQuestions = retryResult.data.suggestedQuestions
            usedReferences = [...new Set(retryResult.data.usedReferences ?? [])].sort((a, b) => a - b)
            promptTokens = retryResult.usage?.promptTokens
            completionTokens = retryResult.usage?.completionTokens
            totalTokens = retryResult.usage?.totalTokens
          }
          retried = true
          break
        } catch {
          // Weiter zum nächsten Budget
        }
      }
      if (!retried) {
        // Behalte ursprünglichen Fehler-Typ bei
        if (error instanceof LlmProviderError) {
          throw error
        }
        throw new Error(`LLM Chat Fehler: ${errorMessage}`)
      }
    } else {
      // Behalte ursprünglichen Fehler-Typ bei
      if (error instanceof LlmProviderError) {
        throw error
      }
      throw new Error(`LLM Chat Fehler: ${errorMessage}`)
    }
  }
  
  run.onProcessingStep?.({ type: 'parsing_response', message: 'Processing response...' })
  
  // Füge Warnung zur Antwort hinzu, falls vorhanden
  if (warning) {
    answer = `${answer}\n\n⚠️ **Hinweis:** ${warning}`
  }
  
  const llmMs = Date.now() - tL0
  
  // Sende llm_complete direkt nach dem LLM-Aufruf
  run.onProcessingStep?.({
    type: 'llm_complete',
    timingMs: llmMs,
    promptTokens,
    completionTokens,
    totalTokens,
    maxTokens, // Zeige maxTokens für unbegrenzt Modus
  })

  // Generate complete references list from sources (for mapping)
  // WICHTIG: Bei TOC-Queries keine References erfassen (zu voluminös)
  let references: ChatResponse['references'] = []
  if (!run.isTOCQuery) {
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
    references = usedReferences.length > 0
      ? allReferences.filter(ref => usedReferences.includes(ref.number))
      : allReferences // Fallback: If none found, show all
  }

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



