# Chat & Story Mode: Response Generation Process Analysis

## Overview

This document describes the complete process of chat response generation in the CommonKnowledgeScout application. The application supports both **Chat Mode** for direct question-answer interactions and **Story Mode** for narrative knowledge exploration.

## Main Endpoint

**POST** `/api/chat/[libraryId]/stream`

This endpoint uses Server-Sent Events (SSE) for streaming status updates during response generation.

## Processing Steps

### Phase 1: Initialization & Validation

**Step 1.1: Authentication & Load Library Context**
- Authentication check (optional for public libraries)
- Load library context via `loadLibraryChatContext()`
- Supports both authenticated and anonymous users (for public libraries)
- Check if library is public or authentication is required

**Step 1.2: Request Validation**
- Validate request body with Zod schema
- Extract parameters: `message`, `answerLength`, `chatHistory`, `chatId`
- Parse query parameters from URL

**Step 1.3: Extract Facet Filters**
- Parse facet definitions from library
- Extract selected facets from query parameters
- Filter chat configuration parameters (retriever, targetLanguage, etc.)

### Phase 2: Intelligent Question Analysis

**Step 2.1: Start Question Analysis**
- Event: `question_analysis_start`
- Check if automatic retriever analysis is enabled
- Check if explicit retriever is set

**Step 2.2: Automatic Retriever Recommendation** (optional)
- Call `analyzeQuestionForRetriever()` if enabled
- Analyze question to recommend best retriever:
  - `'chunk'`: For specific, detailed questions
  - `'summary'`: For overview questions
  - `'unclear'`: If question is unclear (triggers clarification flow)
- Event: `question_analysis_result` with recommendation and confidence level

**Step 2.3: Clarification Flow** (if question unclear)
- If `recommendation === 'unclear'`:
  - Send suggested clarification questions
  - Event: `complete` with `clarification` flag
  - Process ends here

### Phase 3: Chat Management

**Step 3.1: Create or Load Chat**
- If no `chatId`: Create new chat
  - Chat title: From question analysis or first 60 characters of question
- If `chatId` exists: Load existing chat
  - Check if chat exists
  - `touchChat()`: Update last access timestamp

### Phase 4: Retriever Selection

**Step 4.1: Determine Effective Retriever**
- Priority:
  1. Explicitly set retriever (query parameter)
  2. Question analysis recommended retriever
  3. Default: `'chunk'`
- Event: `retriever_selected` with retriever and reasoning

**Step 4.2: Determine Chat Configuration**
- Merge:
  - Library default configuration
  - Query parameters (targetLanguage, character, socialContext)
- Validate parameter values

### Phase 5: Filter Building

**Step 5.1: Create Filters**
- Call `buildFilters()` with:
  - Query parameters
  - Library context
  - User email (empty for anonymous users)
  - Library ID
  - Effective retriever
- Generate:
  - Normalized filters (for MongoDB)
  - Pinecone filters (for vector search)
- Determine mode: `'summaries'` or `'chunks'`

### Phase 6: Start Query Logging

**Step 6.1: Create Query Log**
- Call `startQueryLog()` with all relevant parameters:
  - Library ID, Chat ID, User Email
  - Question, mode, query type (TOC or question)
  - Retriever, chat configuration
  - Facet filters, normalized filters, Pinecone filters
- Store question analysis results (if available)

### Phase 7: Retrieval (Source Search)

**Step 7.1: Start Retrieval**
- Event: `retrieval_start`
- Event: `llm_start` (for later use)
- Select retriever implementation:
  - `summariesMongoRetriever`: For summary mode
  - `chunksRetriever`: For chunk mode

**Step 7.2: Execute Vector Search**
- Call `retrieverImpl.retrieve()`
- Event: `retrieval_progress` during search
- Status updates: "Searching for relevant sources..."
- Return:
  - `sources`: Array of found sources
  - `stats`: Statistics information (candidatesCount, usedInPrompt, etc.)

**Step 7.3: Process Retrieval Results**
- Event: `retrieval_complete` with number of sources and timing
- Check: If no sources found → Early termination
- Log query steps (for chunk mode)

### Phase 8: Prompt Creation

**Step 8.1: Build Prompt**
- Status update: "Creating prompt..."
- Call `buildPrompt()` with:
  - Question
  - Found sources
  - Answer length (normalized: 'unlimited' → 'detailed')
  - Chat configuration (language, character, social context, gender-inclusive)
  - Chat history (if available)
  - Facet filters (for context in prompt)
- Add note (chunk mode only): If fewer documents used than found

**Step 8.2: Prompt Logging**
- Store prompt in database
- Event: `prompt_complete` with:
  - Prompt length
  - Number of documents used
  - Estimated token count

### Phase 9: LLM Call

**Step 9.1: Determine API Key**
- Priority:
  1. Public API key (from library configuration)
  2. Global API key (from environment variables)
- Model: `OPENAI_CHAT_MODEL_NAME` or default: `'gpt-4o-mini'`
- Temperature: `OPENAI_CHAT_TEMPERATURE` or default: `0.3`

**Step 9.2: Call OpenAI API**
- Status update: "Generating answer..."
- Call `callOpenAI()` with model, temperature, prompt, and API key
- Parse response with token usage information

**Step 9.3: Handle Context Length Exceeded Error**
- If `maximum context length` error:
  - Automatic retry logic with reduced budgets
  - Reduce sources by budget
  - New prompt with reduced sources and 'short' answer length
  - Retry LLM call

**Step 9.4: LLM Complete**
- Event: `llm_complete` with:
  - Timing (LLM milliseconds)
  - Prompt tokens
  - Completion tokens
  - Total tokens

### Phase 10: Response Processing

**Step 10.1: Parse Structured Response**
- Status update: "Processing answer..."
- Call `parseStructuredLLMResponse()`:
  - Extract answer
  - Extract suggested questions
  - Extract used references (numbers)

**Step 10.2: Build References**
- Generate complete references list from all sources
- Map actually used references (if available)
- Fallback: Show all references if none explicitly used

**Step 10.3: Finalize Query Log**
- Call `finalizeQueryLog()` with:
  - Answer
  - Sources (with metadata)
  - References
  - Suggested questions
  - Timing information
  - Token usage

### Phase 11: Finalization

**Step 11.1: Send Complete Event**
- Event: `complete` with:
  - Answer
  - References
  - Suggested questions
  - Query ID
  - Chat ID

**Step 11.2: Save Processing Logs**
- Store all processing steps in database
- Close stream

## Retriever Implementations

### Summary Retriever (`summariesMongoRetriever`)
- Searches MongoDB for summary documents
- Filters by facets and other filters
- Sorts by relevance
- Returns all matching documents

### Chunk Retriever (`chunksRetriever`)
- Uses vector search in Pinecone
- Searches for semantically similar text chunks
- Filters by metadata (facets, etc.)
- Returns top-K most relevant chunks
- Can reduce sources by budget

## Processing Events (SSE)

The following events are sent during processing:

1. `question_analysis_start` - Question analysis begins
2. `question_analysis_result` - Analysis result with recommendation
3. `retriever_selected` - Retriever was selected
4. `retrieval_start` - Retrieval begins
5. `retrieval_progress` - Progress during retrieval
6. `retrieval_complete` - Retrieval completed
7. `prompt_complete` - Prompt created
8. `llm_start` - LLM call begins
9. `llm_progress` - Progress during LLM call
10. `llm_complete` - LLM call completed
11. `parsing_response` - Answer is being processed
12. `complete` - Complete answer ready
13. `error` - Error occurred

## Error Handling

- **No Sources Found**: Early termination with appropriate message
- **Context Length Exceeded**: Automatic retry logic with reduced budgets
- **API Error**: Error event is sent, query log is updated
- **Invalid Request**: Validation error is returned

## Performance Metrics

- **Retrieval Time**: Measured from retrieval start to end
- **LLM Time**: Measured from LLM call to response parsing
- **Token Usage**: Prompt tokens, completion tokens, total tokens
- **Query Logging**: All steps are stored in database

## Special Features

- **Public Libraries**: Support for anonymous users with public API key
- **TOC Questions**: Special handling for table of contents questions
- **Chat History**: Context from previous questions/answers is used in prompt
- **Facet Filters**: Used both for retrieval and prompt context
- **Gender-Inclusive**: Optional gender-neutral formulations in answers
- **Story Mode**: Narrative exploration of knowledge topics with structured topic overview

