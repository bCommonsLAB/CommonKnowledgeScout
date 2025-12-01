/**
 * Status-Updates für Chat-Verarbeitung
 */
export type ChatProcessingStep = 
  | { type: 'cache_check'; parameters: { targetLanguage?: string; character?: string; accessPerspective?: string; socialContext?: string; filters?: Record<string, unknown> }; cacheHash?: string; documentCount?: number }
  | { type: 'cache_check_complete'; found: boolean; queryId?: string; cacheHash?: string; documentCount?: number; cachedQueryId?: string }
  | { type: 'question_analysis_start'; question: string }
  | { type: 'question_analysis_result'; recommendation: 'chunk' | 'summary' | 'unclear'; confidence: 'high' | 'medium' | 'low'; chatTitle?: string }
  | { type: 'retriever_selected'; retriever: 'chunk' | 'summary'; reason?: string }
  | { type: 'retrieval_start'; retriever: 'chunk' | 'summary' }
  | { type: 'retrieval_progress'; sourcesFound: number; message?: string }
  | { type: 'retrieval_complete'; sourcesCount: number; uniqueFileIdsCount?: number; timingMs: number; summaryMode?: 'chapters' | 'summary' | 'teaser'; initialMatches?: number; neighborsAdded?: number; topKRequested?: number; budgetUsed?: number; answerLength?: string }
  | { type: 'prompt_building'; message?: string }
  | { type: 'prompt_complete'; promptLength: number; documentsUsed: number; tokenCount: number }
  | { type: 'llm_start'; model: string }
  | { type: 'llm_progress'; message?: string }
  | { type: 'llm_complete'; timingMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number; maxTokens?: number }
  | { type: 'parsing_response'; message?: string }
  | { type: 'complete'; answer: string; references: unknown[]; suggestedQuestions: string[]; queryId: string; chatId: string; storyTopicsData?: import('@/types/story-topics').StoryTopicsData }
  | { type: 'error'; error: string }

/**
 * Format für SSE-Nachrichten
 */
export function formatSSE(data: ChatProcessingStep): string {
  return `data: ${JSON.stringify(data)}\n\n`
}


