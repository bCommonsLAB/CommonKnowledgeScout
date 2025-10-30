/**
 * Strukturierte Chat-Antwort mit Referenzen und vorgeschlagenen Fragen
 */
export interface ChatResponse {
  /** Markdown-formatierter Antworttext mit Referenz-Nummern [1], [2], etc. */
  answer: string
  /** Array von Referenz-Objekten für auf/zu klappbare Anzeige im Frontend */
  references: Array<{
    number: number
    fileId: string
    fileName?: string
    description: string
  }>
  /** Array mit 7 nächsten sinnvollen Fragen basierend auf dem Kontext */
  suggestedQuestions: string[]
}

/**
 * LLM Response (diese Felder werden vom LLM generiert)
 */
export interface LLMChatResponse {
  answer: string
  suggestedQuestions: string[]
  /** Array von Referenznummern, die tatsächlich in der Antwort verwendet wurden */
  usedReferences: number[]
}

