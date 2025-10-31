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
  level: 'question' | 'chapter' | 'summary' | 'chunk' | 'answer';
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
  libraryId: string;
  userEmail: string;
  question: string;
  mode: 'concise' | 'verbose' | 'summaries' | 'chunks';
  answerLength?: 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'; // Antwortlänge-Parameter
  retriever?: 'chunk' | 'doc' | 'summary'; // Retriever-Methode
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
  createdAt: Date;
  status: 'pending' | 'ok' | 'error';
  error?: { message: string; stage?: string };
}




