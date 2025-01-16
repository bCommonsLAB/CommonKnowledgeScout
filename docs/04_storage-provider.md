# Storage Provider System

## Architektur-Übersicht

Das Storage Provider System ist eine modulare Architektur zur Abstraktion verschiedener Dateispeicher-Backends. Es ermöglicht die einheitliche Handhabung von Dateien und Ordnern über verschiedene Speichersysteme hinweg.

### System-Architektur

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

### Detaillierter Datenfluss für Dateioperationen

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

### Provider-Integration-Architektur

```mermaid
classDiagram
    class StorageProvider {
        <<interface>>
        +String name
        +String id
        +validateConfiguration()
        +listItemsById(folderId)
        +getItemById(itemId)
        +createFolder(parentId, name)
        +deleteItem(itemId)
        +moveItem(itemId, newParentId)
        +uploadFile(parentId, file)
        +getBinary(fileId)
    }
    
    class BaseProvider {
        #config: ProviderConfig
        #cache: CacheManager
        +constructor(config)
        #validateAuth()
        #handleError()
    }
    
    class FileSystemProvider {
        -basePath: string
        -idCache: Map
        -pathCache: Map
        +generateFileId()
        +findPathById()
    }
    
    class SharePointProvider {
        -siteUrl: string
        -credentials: SPCredentials
        +authenticateRequest()
        +mapSPItemToStorage()
    }
    
    class GoogleDriveProvider {
        -clientId: string
        -clientSecret: string
        +authenticateWithOAuth()
        +mapGDriveItemToStorage()
    }

    StorageProvider <|-- BaseProvider
    BaseProvider <|-- FileSystemProvider
    BaseProvider <|-- SharePointProvider
    BaseProvider <|-- GoogleDriveProvider
```

## Provider-Integration

### Implementierungsebenen

1. **UI-Ebene** (`/src/components/library/`)
   - Benutzerinteraktion
   - State Management
   - Event Handling
   - Provider-Auswahl

2. **Factory-Ebene** (`/src/lib/storage/storage-factory.ts`)
   - Provider-Instanziierung
   - Konfigurationsmanagement
   - Provider-Typ-Erkennung
   - Instanz-Caching

3. **Client-Ebene** (`/src/lib/storage/filesystem-client.ts`)
   - HTTP-Kommunikation
   - Request/Response-Handling
   - Client-seitiges Caching
   - Fehlerbehandlung

4. **API-Ebene** (`/app/api/storage/[provider]/route.ts`)
   - Request-Routing
   - Authentifizierung
   - Validierung
   - Error-Handling

5. **Provider-Ebene** (`/src/lib/storage/providers/`)
   - Backend-Integration
   - Datei-Operationen
   - Format-Mapping
   - Caching

### Integration neuer Provider

```typescript
// 1. Provider-Interface implementieren
class NewStorageProvider extends BaseProvider implements StorageProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    // Provider-spezifische Implementierung
  }
  
  // Weitere Interface-Methoden implementieren
}

// 2. Factory erweitern
class StorageFactory {
  async getProvider(libraryId: string): Promise<StorageProvider> {
    const library = this.findLibrary(libraryId);
    
    switch (library.type) {
      case 'local':
        return new FileSystemProvider(library.config);
      case 'sharepoint':
        return new SharePointProvider(library.config);
      case 'gdrive':
        return new GoogleDriveProvider(library.config);
      // Neuen Provider hinzufügen
      case 'newtype':
        return new NewStorageProvider(library.config);
    }
  }
}

// 3. API Route erstellen
// /app/api/storage/[provider]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { provider: string } }
) {
  const provider = await getProviderInstance(params.provider);
  // Request verarbeiten
}
```

### Provider-spezifische Anforderungen

#### Filesystem
- Lokaler Dateizugriff
- Pfad-Mapping
- Berechtigungsprüfung
- ID-Generierung

#### SharePoint
- OAuth Authentication
- Graph API Integration
- Site/Library Mapping
- Berechtigungsmodell

#### Google Drive
- OAuth 2.0 Flow
- API Quotas
- File Picking
- Sharing Settings

#### OneDrive
- Microsoft Authentication
- Graph API
- Delta Queries
- Sharing Links 