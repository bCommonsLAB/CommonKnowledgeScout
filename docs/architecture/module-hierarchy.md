# Module Hierarchy

Visual representation of the Common Knowledge Scout module organization and dependencies.

## Module Tree

```
Common Knowledge Scout
│
├── Core Infrastructure (Layer 1)
│   ├── middleware.ts
│   │   └── Authentication & Routing
│   ├── app/layout.tsx
│   │   └── Root Layout & Providers
│   ├── instrumentation.ts
│   │   └── External Jobs Worker Startup
│   └── lib/
│       ├── env.ts
│       │   └── Environment Variables
│       ├── auth.ts
│       │   └── Authentication Helpers
│       └── mongodb-service.ts
│           └── Database Connection
│
├── Storage Layer (Layer 2)
│   ├── lib/storage/
│   │   ├── types.ts
│   │   │   └── Type Definitions
│   │   ├── storage-factory.ts
│   │   │   ├── LocalStorageProvider
│   │   │   └── StorageFactory
│   │   ├── filesystem-provider.ts
│   │   │   └── FileSystemProvider
│   │   ├── onedrive-provider.ts
│   │   │   └── OneDriveProvider
│   │   ├── onedrive-provider-server.ts
│   │   │   └── OneDriveServerProvider
│   │   ├── filesystem-client.ts
│   │   │   └── FilesystemClient
│   │   ├── server-provider.ts
│   │   │   └── Server Provider Helper
│   │   ├── storage-factory-mongodb.ts
│   │   │   └── MongoDBStorageFactory
│   │   ├── storage-service.ts
│   │   ├── shadow-twin.ts
│   │   └── supported-types.ts
│   ├── contexts/storage-context.tsx
│   │   └── StorageContextProvider
│   └── hooks/use-storage-provider.tsx
│       └── useStorageProvider Hook
│
├── Library System (Layer 3)
│   ├── types/library.ts
│   │   └── Library Type Definitions
│   ├── atoms/library-atom.ts
│   │   └── Library State Atoms
│   ├── lib/services/library-service.ts
│   │   └── LibraryService
│   └── components/library/
│       ├── library.tsx
│       │   └── Main Library Component
│       ├── library-header.tsx
│       ├── library-switcher.tsx
│       ├── file-tree.tsx
│       ├── file-list.tsx
│       ├── file-preview.tsx
│       └── ... (other library components)
│
├── Chat System (Layer 4)
│   ├── types/chat.ts
│   │   └── Chat Type Definitions
│   ├── lib/chat/
│   │   ├── constants.ts
│   │   ├── orchestrator.ts
│   │   ├── loader.ts
│   │   ├── config.ts
│   │   ├── common/
│   │   │   ├── prompt.ts
│   │   │   ├── filters.ts
│   │   │   ├── llm.ts
│   │   │   └── question-analyzer.ts
│   │   └── retrievers/
│   │       ├── chunks.ts
│   │       └── summaries-mongo.ts
│   ├── app/api/chat/[libraryId]/
│   │   └── stream/route.ts
│   └── components/library/chat/
│       └── ... (chat components)
│
└── API Routes & Components (Layer 5)
    ├── app/api/
    │   ├── storage/
    │   ├── chat/
    │   ├── libraries/
    │   ├── external/jobs/
    │   └── ... (other API routes)
    └── components/
        ├── ui/ (Shadcn UI components)
        ├── shared/
        └── ... (other components)
```

## Dependency Flow

```
Layer 1 (Core Infrastructure)
    ↓
Layer 2 (Storage Layer)
    ↓
Layer 3 (Library System)
    ↓
Layer 4 (Chat System)
    ↓
Layer 5 (API Routes & Components)
```

## Module Descriptions

### Core Infrastructure
Foundation layer providing authentication, database, and environment configuration. No internal dependencies.

### Storage Layer
Abstracts file storage operations across multiple backends (local filesystem, OneDrive). Depends on Core Infrastructure.

### Library System
Manages library data and provides UI components for file browsing and management. Depends on Storage Layer.

### Chat System
Provides RAG-based chat functionality for knowledge exploration. Depends on Library System and Storage Layer.

### API Routes & Components
User-facing API endpoints and React components. Depends on all previous layers.

## Key Principles

1. **Layered Architecture**: Each layer depends only on layers below it
2. **Dependency Injection**: Higher layers receive dependencies from lower layers
3. **Type Safety**: TypeScript interfaces ensure contract compliance
4. **Separation of Concerns**: Each module has a single, well-defined responsibility





