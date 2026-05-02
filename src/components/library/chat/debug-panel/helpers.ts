/**
 * Pure-Helper fuer DebugPanel (Welle 3-III-b).
 *
 * Extrahiert aus debug-panel.tsx:
 * - simplifyLabel        — Menschenlesbare Labels fuer Retrieval-Steps
 * - getRetrieverLabel    — Label fuer Retriever-Typ
 * - recommendationMatches — Pruefdetermismus fuer Retriever-Empfehlung
 * - explainStepLabel     — Erklaerungstext fuer einen Step
 *
 * Alle Funktionen sind seiteneffektfrei und deterministisch.
 * getAnswerLengthLabel bleibt in der Komponente, da es t() benoetigt.
 */

import type { QueryRetrievalStep } from '@/types/query-log'
import { RETRIEVER_LABELS } from '@/lib/chat/constants'

/** Gibt einen menschenlesbaren Label fuer ein (stage, level)-Paar zurueck */
export function simplifyLabel(stage: string, level: string): string {
  if (stage === 'cache_check' && level === 'question') return 'Step 0: Cache Check'
  if (stage === 'embed' && level === 'question') return 'Step 1: Embed question'
  if (stage === 'query' && level === 'chunk') return 'Step 2a: Search chunks'
  if (stage === 'query' && level === 'summary') return 'Step 2b: Load summaries'
  if (stage === 'list' && level === 'summary') return 'List summaries'
  if (stage === 'list' && level === 'chunkSummary') return 'List documents (for all chunks)'
  if (stage === 'query' && level === 'chunkSummary') return 'Load all chunks (without embedding search)'
  if (stage === 'fetchNeighbors' && level === 'chunk') return 'Step 3: Load neighbors'
  if (stage === 'llm' && level === 'answer') return 'Step 4: Generate answer'
  return `${stage} [${level}]`
}

/** Gibt das Label fuer einen Retriever-Typ zurueck */
export function getRetrieverLabel(retriever?: string): string {
  if (!retriever) return '-'
  return RETRIEVER_LABELS[retriever as keyof typeof RETRIEVER_LABELS] || retriever
}

/**
 * Prueft, ob die Retriever-Empfehlung mit dem tatsaechlich verwendeten Retriever
 * uebereinstimmt. Wird fuer Farb-Feedback im Debug-Panel verwendet.
 */
export function recommendationMatches(retriever?: string, recommendation?: string): boolean {
  if (!retriever || !recommendation) return false
  if (recommendation === 'unclear') return false
  if (recommendation === 'chunk' && retriever === 'chunk') return true
  if (recommendation === 'summary' && (retriever === 'summary' || retriever === 'doc')) return true
  return false
}

/** Gibt einen Erklaerungstext fuer einen Retrieval-Step zurueck */
export function explainStepLabelFromStep(step: QueryRetrievalStep): string {
  if (step.stage === 'cache_check' && step.level === 'question') {
    return step.cacheFound
      ? 'Cache wurde gefunden. Die Antwort wurde aus dem Cache geladen, ohne neue Berechnung durchzuführen.'
      : 'Cache-Check durchgeführt, aber kein passender Cache gefunden. Die Antwort wird neu generiert.'
  }
  if (step.stage === 'embed' && step.level === 'question') return 'Your question is translated into a numerical form (vector). This allows the system to measure "similarity" to text passages later.'
  if (step.stage === 'query' && step.level === 'chunk') return 'Search for the most relevant text passages (chunks). Result is a sorted hit list with relevance scores.'
  if (step.stage === 'query' && step.level === 'summary') return 'Chapter summaries are loaded and used as compact context (no ranking needed).'
  if (step.stage === 'list' && step.level === 'summary') return 'Lists all chapter summaries according to filters (purely tabular, without ranking).'
  if (step.stage === 'list' && step.level === 'chunkSummary') return 'Lists all documents and loads all their chunks without embedding search.'
  if (step.stage === 'query' && step.level === 'chunkSummary') return 'Loads all chunks of filtered documents without semantic search (metadata filter only).'
  if (step.stage === 'fetchNeighbors' && step.level === 'chunk') return 'For the best chunks, the direct neighboring passages are fetched. This creates more context and fewer sentences taken out of context.'
  if (step.stage === 'llm' && step.level === 'answer') return 'A comprehensible answer is formulated from the selected passages. The sources used are listed below.'
  return ''
}
