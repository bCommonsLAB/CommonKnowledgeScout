/**
 * @fileoverview Retriever Mode Decider - Entscheidet zwischen Retriever-Modi
 * 
 * @description
 * Entscheidet automatisch zwischen summary, chunkSummary und chunk (RAG) Retriever-Modi
 * basierend auf Token-Budget, Chunk-Anzahl und Query-Typ.
 * 
 * @module chat
 * 
 * @exports
 * - decideRetrieverMode: Entscheidet den optimalen Retriever-Modus
 * - RetrieverDecision: Rückgabe-Typ für Retriever-Entscheidung
 * 
 * @usedIn
 * - src/app/api/chat/[libraryId]/stream/route.ts: Retriever-Auswahl vor Orchestration
 * - src/lib/chat/orchestrator.ts: Optional für Retriever-Auswahl
 * 
 * @dependencies
 * - @/lib/repositories/doc-meta-repo: MongoDB Repository für chunkCount-Abfrage
 * - @/lib/chat/common/budget: Token-Budget-Verwaltung
 * - @/lib/chat/constants: Retriever-Typen
 */

import { computeDocMetaCollectionName, sumChunkCounts } from '@/lib/repositories/doc-meta-repo'
import { getTokenBudget } from './budget'
import type { Retriever } from '@/lib/chat/constants'

export interface RetrieverDecision {
  mode: 'summary' | 'chunkSummary' | 'chunk'
  reason: string
  totalChunks?: number
  estimatedTokens?: number
  tokenBudget?: number
}

/**
 * Durchschnittliche Token-Anzahl pro Chunk
 * Basierend auf: ~1000-1500 Zeichen pro Chunk, ~4 Zeichen ≈ 1 Token
 * Konservativ: 300 Tokens pro Chunk
 */
const AVG_TOKENS_PER_CHUNK = Number(process.env.CHAT_AVG_TOKENS_PER_CHUNK) || 300

/**
 * Entscheidet den optimalen Retriever-Modus basierend auf:
 * - Query-Typ (TOC vs. normale Frage)
 * - Explizite Retriever-Auswahl
 * - Token-Budget und Chunk-Anzahl (nur für TOC)
 * 
 * Vereinfachte Logik:
 * - TOC: summary oder chunkSummary basierend auf Token-Budget
 * - Normale Fragen: Immer chunk (RAG)
 * 
 * @param params - Parameter für Retriever-Entscheidung
 * @returns Entscheidung mit Modus und Begründung
 */
export async function decideRetrieverMode(params: {
  libraryId: string
  userEmail: string
  filter: Record<string, unknown>
  isTOCQuery: boolean
  explicitRetriever?: Retriever | null
}): Promise<RetrieverDecision> {
  const { libraryId, userEmail, filter, isTOCQuery, explicitRetriever } = params

  // 1. TOC-Queries: Entscheidung basierend auf Token-Budget
  if (isTOCQuery) {
    // Explizite Auswahl respektieren (nur summary oder chunkSummary für TOC)
    // WICHTIG: 'auto' wird nicht als explizite Auswahl behandelt
    if (explicitRetriever && explicitRetriever !== 'auto') {
      // Nur 'doc'/'summary' oder 'chunkSummary' sind erlaubt für TOC
      if (explicitRetriever === 'doc' || explicitRetriever === 'summary') {
        return {
          mode: 'summary',
          reason: `TOC query: Explicitly set to summary`,
        }
      }
      if (explicitRetriever === 'chunkSummary') {
        return {
          mode: 'chunkSummary',
          reason: `TOC query: Explicitly set to chunkSummary`,
        }
      }
      // Fallback: Wenn anderer Wert (z.B. 'chunk'), ignoriere und verwende automatische Entscheidung
    }

    // Automatische Entscheidung basierend auf Token-Budget
    const tokenBudget = getTokenBudget()
    
    if (!tokenBudget) {
      // Fallback: Wenn kein Token-Budget, verwende summary
      return {
        mode: 'summary',
        reason: 'TOC query: No token budget configured, using summary mode',
        tokenBudget: undefined,
      }
    }

    // Berechne totalChunks für gefilterte Dokumente
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(userEmail || '', libraryId, strategy)
    
    let totalChunks = 0
    
    try {
      const result = await sumChunkCounts(libraryKey, filter)
      totalChunks = result.totalChunks
    } catch (error) {
      console.error('[retriever-decider] Fehler beim Abrufen von chunkCount:', error)
      // Bei Fehler: Fallback auf summary
      return {
        mode: 'summary',
        reason: `TOC query: Error calculating chunk count, using summary mode: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    // Berechne geschätzte Token-Anzahl
    const estimatedTokens = totalChunks * AVG_TOKENS_PER_CHUNK

    // Entscheidung: chunkSummary wenn Budget ausreicht, sonst summary
    if (estimatedTokens < tokenBudget) {
      return {
        mode: 'chunkSummary',
        reason: `TOC query: ChunkSummary mode: ${totalChunks} chunks × ${AVG_TOKENS_PER_CHUNK} tokens/chunk = ${estimatedTokens} tokens < ${tokenBudget} token budget`,
        totalChunks,
        estimatedTokens,
        tokenBudget,
      }
    } else {
      return {
        mode: 'summary',
        reason: `TOC query: Summary mode: ${totalChunks} chunks × ${AVG_TOKENS_PER_CHUNK} tokens/chunk = ${estimatedTokens} tokens >= ${tokenBudget} token budget`,
        totalChunks,
        estimatedTokens,
        tokenBudget,
      }
    }
  }

  // 2. Normale Fragen: Immer RAG (chunk)
  // Explizite Auswahl respektieren (nur summary oder chunk für normale Fragen)
  if (explicitRetriever && explicitRetriever !== 'auto') {
    // chunkSummary ist nur für TOC verfügbar
    const mode = explicitRetriever === 'doc' ? 'summary' : explicitRetriever === 'chunk' ? 'chunk' : 'chunk'
    return {
      mode: mode as 'summary' | 'chunk',
      reason: `Explicitly set to ${mode}`,
    }
  }

  // Automatisch: Immer RAG für normale Fragen
  return {
    mode: 'chunk',
    reason: 'Normal query: Always using RAG (chunk) mode for semantic search',
  }
}

