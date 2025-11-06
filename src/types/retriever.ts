import type { AnswerLength } from '@/lib/chat/constants'

export interface RetrieverInput {
  libraryId: string
  userEmail: string
  question: string
  answerLength: AnswerLength
  filters: Record<string, unknown>
  queryId: string
  context: {
    vectorIndex: string
  }
  apiKey?: string  // Optional: Library-spezifischer OpenAI API-Key für Embeddings
}

export interface RetrievedSource {
  id: string
  fileName?: string
  fileId?: string // fileId extrahiert aus id (z.B. "fileId-0" → "fileId")
  chunkIndex?: number
  score?: number
  text: string
  sourceType?: 'slides' | 'body' | 'video_transcript' | 'chapter' // Quelle des Chunks
  // Zusätzliche Metadaten für benutzerfreundliche Beschreibungen
  slidePageNum?: number // Für Slides: Seiten-Nummer
  slideTitle?: string // Für Slides: Titel der Slide
  chapterTitle?: string // Für Chapters: Kapitel-Titel
  chapterOrder?: number // Für Chapters: Reihenfolge
  // Dynamische Metadaten basierend auf Facetten-Definitionen der Library
  metadata?: Record<string, unknown> // Key-Value-Paare: metaKey -> Wert (getypt nach FacetDef.type)
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


