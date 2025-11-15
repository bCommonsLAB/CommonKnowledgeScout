import type { SocialContext, TargetLanguage, AnswerLength, Retriever, Character, AccessPerspective } from '@/lib/chat/constants'
import type { StoryTopicsData } from '@/types/story-topics'

export interface QueryRetrievalResultItem {
  id: string;
  type: 'chapter' | 'summary' | 'chunk';
  score?: number;
  distance?: number;
  metadata?: Record<string, unknown>;
  snippet?: string;
}

export interface QueryRetrievalStep {
  indexName: string;
  namespace?: string;
  stage: 'embed' | 'list' | 'query' | 'fetchNeighbors' | 'rerank' | 'aggregate' | 'llm';
  level: 'question' | 'chapter' | 'summary' | 'chunk' | 'chunkSummary' | 'answer';
  topKRequested?: number;
  topKReturned?: number;
  // Erweiterte Observability
  candidatesCount?: number; // Anzahl gefilterter Kandidaten (z. B. Docs)
  usedInPrompt?: number;    // Anzahl tatsächlich in Prompt eingeflossener Elemente (z. B. Docs)
  decision?: 'chapters' | 'docs';
  filtersEffective?: {
    normalized?: Record<string, unknown>;
    pinecone?: Record<string, unknown>;
  };
  queryVectorInfo?: { source: 'question' | 'rerank' | 'hybrid'; note?: string };
  results?: QueryRetrievalResultItem[];
  timingMs?: number;
  startedAt?: Date; // Startzeitpunkt des Schritts (für Trace/Gantt)
  endedAt?: Date;   // Endzeitpunkt des Schritts (für Trace/Gantt)
}

export interface QueryPromptInfo {
  provider: 'openai' | 'anthropic' | 'azureOpenAI' | 'other';
  model: string;
  temperature?: number;
  prompt: string; // secrets vorher entfernen/maskieren
}

export interface QueryTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface QuestionAnalysisInfo {
  recommendation: 'chunk' | 'summary' | 'unclear';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface QueryLog {
  queryId: string;
  /** Chat-ID, zu der diese Query gehört (required für neue Queries) */
  chatId: string;
  libraryId: string;
  /** E-Mail-Adresse des Benutzers (für authentifizierte Nutzer) */
  userEmail?: string;
  /** Session-ID für anonyme Nutzer (wenn kein userEmail vorhanden) */
  sessionId?: string;
  question: string;
  mode: 'concise' | 'verbose' | 'summaries' | 'chunks';
  /** Typ der Query: 'toc' für Inhaltsverzeichnis, 'question' für normale Fragen */
  queryType?: 'toc' | 'question';
  answerLength?: AnswerLength; // Antwortlänge-Parameter
  retriever?: Retriever; // Retriever-Methode
  /** Zielsprache für die Antwort */
  targetLanguage?: TargetLanguage;
  /** Charakter/Perspektive für die Antwort (Array, kann leer sein) */
  character?: Character[];
  /** Zugangsperspektive für die Antwort (Array, kann leer sein) */
  accessPerspective?: AccessPerspective[];
  /** Sozialer Kontext/Sprachebene */
  socialContext?: SocialContext;
  /** Gendergerechte Formulierung aktivieren/deaktivieren */
  genderInclusive?: boolean;
  facetsSelected?: Record<string, unknown>;
  filtersNormalized?: Record<string, unknown>;
  filtersPinecone?: Record<string, unknown>;
  retrieval?: QueryRetrievalStep[];
  prompt?: QueryPromptInfo;
  answer?: string;
  references?: Array<{ number: number; fileId: string; fileName?: string; description: string }>; // Referenzen für die Antwort
  suggestedQuestions?: string[]; // Vorgeschlagene Folgefragen
  sources?: Array<{ id: string; fileName?: string; chunkIndex?: number; score?: number }>; // zur schnellen Sicht
  timing?: { retrievalMs?: number; llmMs?: number; totalMs?: number };
  tokenUsage?: QueryTokenUsage;
  questionAnalysis?: QuestionAnalysisInfo; // Analyse-Ergebnis für Retriever-Auswahl
  /** Strukturierte Themenübersicht für TOC-Queries */
  storyTopicsData?: StoryTopicsData;
  /** User-freundliche Processing-Logs (nicht zu verwechseln mit internen Debug-Logs) */
  processingLogs?: import('./chat-processing').ChatProcessingStep[];
  createdAt: Date;
  status: 'pending' | 'ok' | 'error';
  error?: { message: string; stage?: string };
}




