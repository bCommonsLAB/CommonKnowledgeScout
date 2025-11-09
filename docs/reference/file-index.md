# File Index

Complete index of all documented source files with descriptions, exports, and usage information.

## Core Infrastructure ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/middleware.ts` | core | Authentication and routing middleware | `default`, `config` | Next.js framework, all routes |
| `src/app/layout.tsx` | core | Root layout component | `default`, `metadata` | Next.js framework, all pages |
| `src/instrumentation.ts` | core | Next.js instrumentation hook | `register` | Next.js framework |
| `src/lib/env.ts` | core | Environment variable helpers | `getPublicAppUrl`, `getSelfBaseUrl`, `getSecretaryConfig`, `getVimeoConfig` | API routes, services |
| `src/lib/auth.ts` | core | Authentication helpers | `getLibraryId`, `isAuthenticated`, `getUserInfo` | API routes, components |
| `src/lib/mongodb-service.ts` | core | MongoDB database service | `connectToDatabase`, `getCollection` | Services, repositories, API routes |

## Storage Layer ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/lib/storage/types.ts` | storage | Storage type definitions | `StorageItemMetadata`, `StorageItem`, `StorageValidationResult`, `StorageProvider` | All storage files |
| `src/lib/storage/storage-factory.ts` | storage | Storage provider factory | `StorageFactory`, `LocalStorageProvider` | Contexts, API routes, components |
| `src/lib/storage/filesystem-provider.ts` | storage | Local filesystem provider | `FileSystemProvider` | Storage factory |
| `src/lib/storage/onedrive-provider.ts` | storage | OneDrive provider | `OneDriveProvider` | Storage factory |
| `src/lib/storage/storage-factory-mongodb.ts` | storage | MongoDB storage factory | `MongoDBStorageFactory` | MongoDB operations |
| `src/lib/storage/filesystem-client.ts` | storage | Filesystem client | `FileSystemClient` | Client-side operations |
| `src/lib/storage/server-provider.ts` | storage | Server-side provider helper | `getServerProvider` | API routes |
| `src/lib/storage/supported-types.ts` | storage | Supported library types | `SUPPORTED_LIBRARY_TYPES`, `isSupportedLibraryType`, `getSupportedLibraryTypesString` | Storage factory |
| `src/contexts/storage-context.tsx` | storage | Storage React context | `StorageContextProvider`, `useStorage` | Components |
| `src/hooks/use-storage-provider.tsx` | storage | Storage provider hook | `useStorageProvider` | Components |

## Library System ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/types/library.ts` | library | Library type definitions | `ClientLibrary`, `Library`, `LibraryChatConfig`, `StorageConfig`, `PublicLibraryConfig` | All library files |
| `src/atoms/library-atom.ts` | library | Library state atoms | `libraryAtom`, `activeLibraryIdAtom`, `librariesAtom`, `activeLibraryAtom`, `currentFolderIdAtom` | Components |
| `src/lib/services/library-service.ts` | library | Library service | `LibraryService`, `UserLibraries` | API routes, components |
| `src/components/library/library.tsx` | library | Main library component | `Library` | Library page |
| `src/components/library/library-header.tsx` | library | Library header component | TBD | Library component |
| `src/components/library/library-switcher.tsx` | library | Library switcher component | TBD | Library header |

## Chat System ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/types/chat.ts` | chat | Chat type definitions | `Chat` | Chat system |
| `src/lib/chat/constants.ts` | chat | Chat constants | `AnswerLength`, `Retriever`, `TargetLanguage`, `Character`, `SocialContext` | Chat system |
| `src/lib/chat/orchestrator.ts` | chat | Chat orchestration | `runChatOrchestrated`, `OrchestratorInput`, `OrchestratorOutput` | Chat API routes |
| `src/lib/chat/loader.ts` | chat | Chat loader | `loadLibraryChatContext`, `LibraryChatContext` | Chat orchestrator |
| `src/lib/chat/config.ts` | chat | Chat configuration | `chatConfigSchema`, `normalizeChatConfig`, `getVectorIndexForLibrary` | Chat system |
| `src/lib/chat/retrievers/chunks.ts` | chat | Chunk retriever | `chunksRetriever` | Chat orchestrator |
| `src/lib/chat/retrievers/summaries-mongo.ts` | chat | Summary retriever | `summariesMongoRetriever` | Chat orchestrator |
| `src/lib/chat/common/prompt.ts` | chat | Prompt building | `buildPrompt`, `buildTOCPrompt`, `getSourceDescription` | Chat orchestrator |
| `src/lib/chat/common/llm.ts` | chat | LLM calling | `callOpenAI`, `parseOpenAIResponseWithUsage`, `parseStructuredLLMResponse` | Chat orchestrator |
| `src/app/api/chat/[libraryId]/stream/route.ts` | chat | Chat streaming endpoint | `POST` | Chat components |

## External Jobs System ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/lib/external-jobs-repository.ts` | external-jobs | MongoDB repository for external jobs | `ExternalJobsRepository` | Worker, watchdog, API routes, orchestration |
| `src/lib/external-jobs-worker.ts` | external-jobs | Background worker for processing jobs | `ExternalJobsWorker` | Instrumentation, worker status endpoint |
| `src/lib/external-jobs-watchdog.ts` | external-jobs | Timeout monitoring for jobs | `startWatchdog`, `bumpWatchdog`, `clearWatchdog` | Job callbacks, job start |
| `src/lib/external-jobs/context.ts` | external-jobs | Request context parsing | `readContext` | Job callback |
| `src/lib/external-jobs/auth.ts` | external-jobs | Authorization and bypass checks | `isInternalAuthorized`, `authorizeCallback`, `guardProcessId` | Job callbacks, job start |
| `src/lib/external-jobs/policies.ts` | external-jobs | Phase policy extraction | `readPhasesAndPolicies` | Job callback |
| `src/lib/external-jobs/template-decision.ts` | external-jobs | Template execution decision logic | `decideTemplateRun` | Job callback |
| `src/lib/external-jobs/template-run.ts` | external-jobs | Template transformation execution | `runTemplateTransform` | Job callback |
| `src/lib/external-jobs/chapters.ts` | external-jobs | Chapter detection and merging | `analyzeAndMergeChapters` | Job callback |
| `src/lib/external-jobs/storage.ts` | external-jobs | Markdown file storage | `saveMarkdown` | Job callback |
| `src/lib/external-jobs/images.ts` | external-jobs | Image archive extraction | `maybeProcessImages` | Job callback |
| `src/lib/external-jobs/ingest.ts` | external-jobs | RAG ingestion pipeline | `runIngestion` | Job callback, job start |
| `src/lib/external-jobs/complete.ts` | external-jobs | Job completion handler | `setJobCompleted` | Job callback, job start |
| `src/lib/external-jobs/preprocess.ts` | external-jobs | Job preprocessing and analysis | `preprocess`, `PreprocessResult` | Job start, job callback |
| `src/lib/external-jobs/provider.ts` | external-jobs | Storage provider construction | `buildProvider` | Preprocessing, job callback |
| `src/lib/external-jobs/progress.ts` | external-jobs | Progress update processing | `handleProgressIfAny` | Job callback |
| `src/app/api/external/jobs/[jobId]/route.ts` | external-jobs | Main job processing endpoint | `GET`, `POST` | Secretary Service, worker |
| `src/app/api/external/jobs/[jobId]/start/route.ts` | external-jobs | Job execution trigger | `POST` | Worker |
| `src/app/api/external/jobs/route.ts` | external-jobs | Job query endpoint | `GET` | Event monitor components |

## Secretary Service ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/lib/secretary/client.ts` | secretary | HTTP client for Secretary Service API | `SecretaryServiceClient`, `SecretaryServiceError`, response interfaces | Secretary API routes, external jobs |
| `src/lib/secretary/adapter.ts` | secretary | Low-level API call functions | `callPdfProcess`, `callTemplateTransform` | Secretary client, template runner |
| `src/lib/secretary/response-parser.ts` | secretary | Markdown response parsing | `parseSecretaryMarkdownStrict`, `FrontmatterParseResult` | External jobs, Secretary API routes |
| `src/lib/secretary/types.ts` | secretary | Type definitions for Secretary Service | Request/response interfaces | Secretary client, API routes, external jobs |
| `src/app/api/secretary/process-pdf/route.ts` | secretary | PDF transformation endpoint | `POST` | Library components |
| `src/app/api/secretary/process-audio/route.ts` | secretary | Audio transformation endpoint | `POST` | Library components |
| `src/app/api/secretary/process-video/route.ts` | secretary | Video transformation endpoint | `POST` | Library components |
| `src/app/api/secretary/process-image/route.ts` | secretary | Image OCR endpoint | `POST` | Library components |
| `src/app/api/secretary/session/process/route.ts` | secretary | Session import endpoint | `POST` | Event monitor components, session processing |

## Event Job System ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/lib/event-job-repository.ts` | event-job | MongoDB repository for event jobs | `EventJobRepository` | API routes, session processor, event monitor |
| `src/lib/session/session-processor.ts` | event-job | Session data processing utilities | `vttToPlainText`, `extractVideoTranscript`, `buildSessionPayload` | API routes, event monitor components |
| `src/lib/session-repository.ts` | event-job | MongoDB repository for sessions | `SessionRepository` | API routes, event monitor components |
| `src/app/api/event-job/jobs/[jobId]/route.ts` | event-job | Individual job operations | `GET`, `DELETE`, `PATCH` | Event monitor components |
| `src/app/api/event-job/batches/[batchId]/route.ts` | event-job | Individual batch operations | `GET`, `DELETE` | Event monitor components |
| `src/app/api/event-job/events/route.ts` | event-job | Event list and migration | `GET`, `POST` | Event monitor components |

## Transform & Processing ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/lib/transform/transform-service.ts` | transform | Central transformation service | `TransformService`, transform option interfaces, `TransformResult` | Library components, transform API routes |
| `src/lib/transform/image-extraction-service.ts` | transform | PDF image extraction and storage | `ImageExtractionService`, `ExtractedPageImage`, `ImageExtractionResult` | Transform service, external jobs |
| `src/lib/processing/gates.ts` | processing | Phase gate checking utilities | `gateExtractPdf`, `gateTransformTemplate`, `gateIngestRag`, `GateContext`, `GateResult` | Template decision, external jobs |
| `src/lib/processing/phase-policy.ts` | processing | Processing phase control policies | `PhaseDirective`, `PhasePolicies`, policy utilities | External jobs, gates, Secretary API routes |

## Database Repositories ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/lib/db/chats-repo.ts` | chat | MongoDB repository for chat management | `createChat`, `listChats`, `getChatById`, `touchChat`, `deleteChat` | Chat API routes, chat components |
| `src/lib/db/queries-repo.ts` | chat | MongoDB repository for query logging | `insertQueryLog`, `appendRetrievalStep`, `updateQueryLogPartial`, `getQueryLogById`, `listRecentQueries` | Chat API routes, chat modules, query logger |
| `src/lib/repositories/doc-meta-repo.ts` | chat | MongoDB repository for document metadata | `computeDocMetaCollectionName`, `ensureFacetIndexes`, `upsertDocMeta`, `findDocs`, `deleteDocMeta` | Summary retriever, ingestion service |

## API Routes ✅

| File Path | Module | Description | Exports | Used In |
|-----------|--------|-------------|---------|---------|
| `src/app/api/storage/filesystem/route.ts` | storage | Filesystem storage API | `GET`, `POST`, `DELETE`, `PATCH` | Storage providers |
| `src/app/api/libraries/route.ts` | library | Library management API | `GET`, `POST` | Settings, storage context |

## Notes

- Files are organized by functional module
- ✅ = Fully documented with JSDoc headers
- Export information completed for documented files
- Usage information updated based on dependency analysis

## Status

- ✅ Core Infrastructure: Documented (6 files)
- ✅ Storage Layer: Documented (10 files)
- ✅ Library System: Documented (4 files)
- ✅ Chat System: Documented (9 files)
- ✅ External Jobs System: Documented (18 files)
- ✅ Secretary Service: Documented (9 files)
- ✅ Event Job System: Documented (6 files)
- ✅ Transform & Processing: Documented (4 files)
- ✅ Database Repositories: Documented (3 files)
- ✅ API Routes: Documented (2 files)
- **Total Documented: 71 files (~16.7% of ~424 files)**
- ⏳ Remaining Components: Pending
- ⏳ Remaining API Routes: Pending

