---
title: Storage Provider System
---

# Storage Provider System

The Storage Provider System is a modular architecture for abstracting various file storage backends. It enables unified handling of files and folders across different storage systems.

## Core Features

- Modular provider architecture
- Intelligent caching (Client/Server)
- Robust, typed error handling
- Performance optimizations (Streaming, Chunk-Upload, Parallelization)

## Supported Storage Providers

- **Local File System**: Direct access to local filesystem (✅ Implemented)
- **OneDrive**: Integration with Microsoft OneDrive (✅ Implemented)
- **Nextcloud**: Integration with Nextcloud for self-hosted cloud storage (🚧 In Development)

## Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Library Component]
        Factory[Storage Factory]
        Client[Storage Client]
    end
    
    subgraph "API Layer"
        API[Next.js API Routes]
        Auth[Auth Middleware]
    end
    
    subgraph "Provider Layer"
        FSP[Filesystem Provider]
        ODP[OneDrive Provider]
        NCP[Nextcloud Provider]
    end
    
    subgraph "Storage Layer"
        FS[Local Filesystem]
        OD[OneDrive]
        NC[Nextcloud]
    end

    UI --> Factory
    Factory --> Client
    Client --> API
    API --> Auth
    Auth --> FSP & ODP & NCP
    FSP --> FS
    ODP --> OD
    NCP --> NC
```

## Data Flow and Interactions

```mermaid
sequenceDiagram
    participant UI as Library Component
    participant Factory as Storage Factory
    participant Client as Storage Client
    participant Cache as Client Cache
    participant API as API Routes
    participant Auth as Auth Middleware
    participant Provider as Storage Provider
    participant Storage as Storage System

    UI->>Factory: getProvider(libraryId)
    Factory->>Factory: checkProviderType
    Factory->>Client: createProvider(config)
    
    Note over UI,Client: Request file listing
    UI->>Client: listItemsById(folderId)
    Client->>Cache: checkCache(key)
    
    alt Cache Hit
        Cache-->>Client: cachedData
        Client-->>UI: return cachedData
    else Cache Miss
        Client->>API: GET /api/storage/{provider}
        API->>Auth: validateRequest
        Auth->>Provider: authorize
        Provider->>Storage: listFiles(path)
        Storage-->>Provider: rawFiles
        Provider->>Provider: mapToStorageItems
        Provider-->>API: storageItems
        API-->>Client: response
        Client->>Cache: updateCache
        Client-->>UI: return data
    end
```

## Implementation Layers (Excerpt)

1. UI (`src/components/library/*`): Interaction, State, Provider selection
2. Factory (`src/lib/storage/storage-factory.ts`): Instantiation, Configuration
3. Client (`src/lib/storage/filesystem-client.ts`): HTTP, Caching, Error handling
4. API (`app/api/storage/[provider]/route.ts`): Endpoints, Auth, Logging
5. Provider (`src/lib/storage/providers/*`): Backend integration, File operations

## Error Handling (Typed)

```typescript
class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
```

