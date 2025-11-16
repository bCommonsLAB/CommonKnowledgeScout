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

import type { Retriever } from '@/lib/chat/constants'

export interface RetrieverDecision {
  mode: 'summary' | 'chunkSummary' | 'chunk'
  reason: string
  totalChunks?: number
  estimatedTokens?: number
  tokenBudget?: number
}

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
  const { isTOCQuery, explicitRetriever } = params

  // 1. TOC-Queries: Immer summary verwenden (MongoDB Summaries)
  // Dokumente werden nach Datum abwärts sortiert (neueste zuerst)
  // Budget-Prüfung erfolgt im Retriever selbst (nur neueste Dokumente bis Budget)
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
        // Warnung: chunkSummary wird für TOC nicht mehr empfohlen
        return {
          mode: 'chunkSummary',
          reason: `TOC query: Explicitly set to chunkSummary (not recommended - use summary for all documents)`,
        }
      }
      // Fallback: Wenn anderer Wert (z.B. 'chunk'), ignoriere und verwende automatische Entscheidung
    }

    // Automatische Entscheidung: Immer summary für TOC (verwendet alle gefilterten Dokumente)
    // Dokumente werden nach upsertedAt abwärts sortiert (neueste zuerst)
    // Budget-Prüfung erfolgt im Retriever selbst (nur neueste Dokumente bis Budget)
    return {
      mode: 'summary',
      reason: 'TOC query: Always using summary mode (MongoDB summaries) to include all filtered documents, sorted by date (newest first), with budget limit',
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

