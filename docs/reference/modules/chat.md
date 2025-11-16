# Chat Module

Complete documentation for the Chat module.

## Overview

The Chat module provides RAG-based chat functionality for knowledge exploration. Supports both regular chat mode and story mode with structured topic exploration.

## Key Files

### Types
- **`src/types/chat.ts`**: Chat interface for conversation management
- **`src/types/chat-response.ts`**: Chat response types
- **`src/types/chat-processing.ts`**: Chat processing step types
- **`src/types/retriever.ts`**: Retriever input/output types

### Constants & Configuration
- **`src/lib/chat/constants.ts`**: Central chat configuration definitions
- **`src/lib/chat/config.ts`**: Chat configuration normalization

### Orchestration
- **`src/lib/chat/orchestrator.ts`**: Main orchestration for chat response generation
- **`src/lib/chat/loader.ts`**: Library chat context loading

### Retrievers
- **`src/lib/chat/retrievers/chunks.ts`**: Chunk-based retriever
- **`src/lib/chat/retrievers/summaries-mongo.ts`**: Summary-based retriever
- **`src/lib/chat/retrievers/metadata-extractor.ts`**: Metadata extraction

### Common Utilities
- **`src/lib/chat/common/prompt.ts`**: Prompt building utilities
- **`src/lib/chat/common/llm.ts`**: LLM calling utilities
- **`src/lib/chat/common/filters.ts`**: Filter building utilities
- **`src/lib/chat/common/question-analyzer.ts`**: Question analysis for retriever selection
- **`src/lib/chat/common/budget.ts`**: Budget management for source reduction

### API Routes
- **`src/app/api/chat/[libraryId]/stream/route.ts`**: Chat streaming endpoint

## Exports

### Types
- `Chat`: Chat conversation interface
- `ChatResponse`: Chat response structure
- `ChatProcessingStep`: Processing step types
- `RetrieverInput`: Retriever input interface
- `RetrieverOutput`: Retriever output interface
- `OrchestratorInput`: Orchestration input
- `OrchestratorOutput`: Orchestration output

### Constants
- `AnswerLength`: Answer length type and values
- `Retriever`: Retriever method type and values
- `TargetLanguage`: Target language type and values
- `Character`: Character type and values
- `SocialContext`: Social context type and values

### Functions
- `runChatOrchestrated()`: Main orchestration function
- `analyzeQuestionForRetriever()`: Question analysis function
- `buildPrompt()`: Prompt building function
- `callOpenAI()`: LLM calling function

## Usage Examples

### Chat Streaming (API Route)
```typescript
// POST /api/chat/[libraryId]/stream
const response = await fetch('/api/chat/library-id/stream', {
  method: 'POST',
  body: JSON.stringify({
    message: 'What is this library about?',
    answerLength: 'ausführlich',
    chatId: 'optional-chat-id'
  })
});
```

### Using Chat Orchestrator
```typescript
import { runChatOrchestrated } from '@/lib/chat/orchestrator';

const result = await runChatOrchestrated({
  libraryId: 'lib-id',
  question: 'What is this about?',
  retriever: 'chunk',
  chatConfig: { targetLanguage: 'de' }
});
```

## Dependencies

- **Library System**: Uses `@/lib/services/library-service` for library access
- **Database**: Uses `@/lib/mongodb-service` for chat and query persistence
- **Storage**: Uses storage providers for file access
- **External**: Uses OpenAI API for LLM calls, Pinecone for vector search

## Chat Flow

1. **Question Analysis**: Analyze question to recommend retriever
2. **Retrieval**: Retrieve relevant sources using selected retriever
3. **Prompt Building**: Build prompt with sources and configuration
4. **LLM Call**: Call OpenAI API with prompt
5. **Response Parsing**: Parse structured response
6. **Logging**: Log query and response for analytics

## Retriever Types

- **`chunk`**: Semantic search in Pinecone for specific chunks
- **`summary`**: MongoDB search for document summaries
- **`auto`**: Automatic retriever selection based on question analysis

## Story Mode

Story mode provides structured topic exploration:
- TOC (Table of Contents) queries
- Structured topic hierarchy
- Narrative exploration of knowledge

## Configuration Options

- **Answer Length**: kurz, mittel, ausführlich, unbegrenzt
- **Target Language**: de, en, it, fr, es, ar
- **Character**: Various character perspectives
- **Social Context**: Formal, informal, technical
- **Gender Inclusive**: Gender-neutral formulations
















