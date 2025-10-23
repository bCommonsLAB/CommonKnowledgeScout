export interface RetrieverInput {
  libraryId: string
  userEmail: string
  question: string
  answerLength: 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'
  filters: Record<string, unknown>
  queryId: string
  context: {
    vectorIndex: string
  }
}

export interface RetrievedSource {
  id: string
  fileName?: string
  chunkIndex?: number
  score?: number
  text: string
}

export interface RetrieverOutput {
  sources: RetrievedSource[]
  timing: { retrievalMs: number }
  stats?: { candidatesCount?: number; usedInPrompt?: number; decision?: 'chapters' | 'docs' }
}

export interface ChatRetriever {
  retrieve(input: RetrieverInput): Promise<RetrieverOutput>
}

// Typisierte Fehlertypen für konsistente API- und Orchestrator-Behandlung
export class NotAuthenticatedError extends Error { constructor(message = 'Nicht authentifiziert') { super(message); this.name = 'NotAuthenticatedError' } }
export class MissingApiKeyError extends Error { constructor(message = 'API-Key fehlt') { super(message); this.name = 'MissingApiKeyError' } }
export class IndexNotFoundError extends Error { constructor(message = 'Index nicht gefunden') { super(message); this.name = 'IndexNotFoundError' } }
export class OpenAIChatError extends Error { constructor(message = 'OpenAI Chat Fehler') { super(message); this.name = 'OpenAIChatError' } }
export class NoSourcesFoundError extends Error { constructor(message = 'Keine passenden Inhalte gefunden') { super(message); this.name = 'NoSourcesFoundError' } }


