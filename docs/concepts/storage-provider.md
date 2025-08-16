---
title: Storage Provider System
---

# Storage Provider System

Das Storage Provider System ist eine modulare Architektur zur Abstraktion verschiedener Dateispeicher-Backends. Es ermöglicht die einheitliche Handhabung von Dateien und Ordnern über verschiedene Speichersysteme hinweg.

## Core Features

- Modulare Provider-Architektur
- Intelligentes Caching (Client/Server)
- Robuste, typisierte Fehlerbehandlung
- Performance-Optimierungen (Streaming, Chunk-Upload, Parallelisierung)

## Architektur-Übersicht

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
        SPP[SharePoint Provider]
        GDP[Google Drive Provider]
        ODP[OneDrive Provider]
    end
    
    subgraph "Storage Layer"
        FS[Local Filesystem]
        SP[SharePoint]
        GD[Google Drive]
        OD[OneDrive]
    end

    UI --> Factory
    Factory --> Client
    Client --> API
    API --> Auth
    Auth --> FSP & SPP & GDP & ODP
    FSP --> FS
    SPP --> SP
    GDP --> GD
    ODP --> OD
```

## Datenfluss und Interaktionen

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
    
    Note over UI,Client: Datei-Listung anfordern
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

## Implementierungsebenen (Auszug)

1. UI (`src/components/library/*`): Interaktion, State, Provider-Auswahl
2. Factory (`src/lib/storage/storage-factory.ts`): Instanziierung, Konfiguration
3. Client (`src/lib/storage/filesystem-client.ts`): HTTP, Caching, Fehlerbehandlung
4. API (`app/api/storage/[provider]/route.ts`): Endpunkte, Auth, Logging
5. Provider (`src/lib/storage/providers/*`): Backend-Integration, Datei-Operationen

## Fehlerbehandlung (Typisiert)

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


