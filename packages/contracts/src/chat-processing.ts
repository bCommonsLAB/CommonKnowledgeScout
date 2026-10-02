/**
 * @fileoverview Verarbeitungsschritte des Chat-Streams (SSE)
 *
 * @description
 * Die Schritte, die der Chat-Server waehrend einer Antwort ueber den Stream
 * schickt (`/api/chat/[libraryId]/stream`) und die die Oberflaeche als
 * Verarbeitungsstatus zeigt. Jeder Schritt ist ein eigener Fall mit genau den
 * Feldern, die der Server dafuer liefert.
 *
 * **Warum hier**: Die Form lag unter `src/types/chat-processing.ts` in der
 * App. Seit D2 (Plan `story-dreiteilung-fragenchronik`) liest das Paket
 * `@ks/module-story` dieselben Schritte, um sie in einfachen Worten zu zeigen
 * — ein Paket darf aber nichts aus `@/` ziehen. Die App importiert weiter
 * ueber ihren Shim `src/types/chat-processing.ts` (dort bleibt `formatSSE`).
 *
 * @module contracts/chat-processing
 */

import type { StoryTopicsData } from './story-topics'

/**
 * Fehlerkennungen des Chat-Streams (D10d): Die Oberflaeche uebersetzt sie in
 * Klartext und zeigt die technische Meldung als Detail darunter.
 * - `dienst_nicht_erreichbar`: Secretary (Einbettung, Sprachmodell) antwortet nicht
 */
export type StoryFehlerCode = 'dienst_nicht_erreichbar'

export type ChatProcessingStep =
  | { type: 'cache_check'; parameters: { targetLanguage?: string; character?: string; accessPerspective?: string; socialContext?: string; filters?: Record<string, unknown>; llmModel?: string }; cacheHash?: string; documentCount?: number }
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
  | {
      type: 'complete'
      answer: string
      references: unknown[]
      suggestedQuestions: string[]
      queryId: string
      /** Sitzung der Frage; die Themenuebersicht hat keine (D8). */
      chatId?: string
      storyTopicsData?: StoryTopicsData
      /** D5: Kurztitel der Frage vom Sprachmodell (nur Fragen; fehlt bei alten Logs und TOC). */
      shortTitle?: string
    }
  | {
      type: 'error'
      /** Technische Meldung (fuer Protokoll und Detail), nie allein als Oberflaechentext. */
      error: string
      /** D10d: Kennung fuer einen Klartext der Oberflaeche; fehlt bei unbekannten Fehlern. */
      code?: StoryFehlerCode
    }
