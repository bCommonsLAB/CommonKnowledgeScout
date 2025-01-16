# Storage Provider Konzept

## Architektur

Das Storage Provider System ist als abstrahierte Schnittstelle für verschiedene Speichersysteme konzipiert. Es besteht aus mehreren Ebenen:

### 1. Client-Komponenten Ebene
- **Library Component**: Hauptkomponente für UI und Benutzerinteraktion
- **FileTree/FileList**: Spezialisierte Komponenten für Navigation und Anzeige
- **FilePreview**: Vorschau-Komponente für verschiedene Dateitypen

### 2. Provider-Abstraktions-Ebene
- **StorageFactory**: Singleton für Provider-Verwaltung und -Erstellung
- **StorageProvider Interface**: Definiert einheitliche Schnittstelle für alle Provider
- **Konkrete Provider-Implementierungen**: Spezifische Implementierungen für verschiedene Systeme

### 3. API-Ebene
- **API Routes**: Next.js API-Routen für Backend-Kommunikation
- **Storage Service**: Backend-Service für Dateisystem-Operationen
- **Provider-spezifische Handler**: Spezialisierte Handler für verschiedene Speichersysteme

## Storage Provider Interface

Das Interface definiert einheitliche Operationen:

```typescript
interface StorageProvider {
  name: string;
  id: string;
  
  validateConfiguration(): Promise<StorageValidationResult>;
  listItemsById(folderId: string): Promise<StorageItem[]>;
  getItemById(itemId: string): Promise<StorageItem>;
  createFolder(parentId: string, name: string): Promise<StorageItem>;
  deleteItem(itemId: string): Promise<void>;
  moveItem(itemId: string, newParentId: string): Promise<void>;
  uploadFile(parentId: string, file: File): Promise<StorageItem>;
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }>;
}
```

## Integration verschiedener Speichersysteme

### 1. Lokales Dateisystem
- Direkter Zugriff über Backend-APIs
- Filesystem-spezifische Pfad-Behandlung
- Datei-Operationen über Node.js fs-APIs

### 2. SharePoint/OneDrive (Implementierungsmöglichkeit)
- Microsoft Graph API Integration
- OAuth2 Authentifizierung
- Spezialisierte SharePoint-Provider-Implementierung

### 3. Google Drive (Implementierungsmöglichkeit)
- Google Drive API Integration
- OAuth2 Authentifizierung
- Drive-spezifische Metadaten-Behandlung

### 4. Andere Cloud-Speicher
- Provider-spezifische API-Integration
- Authentifizierungs-Handling
- Metadaten-Mapping auf StorageItem Interface

## Datenfluss
### Event-Sequenz für Dateioperationen

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
    <!-- Participants -->
    <style>
        text { font-family: Arial, sans-serif; font-size: 14px; }
        .participant { font-weight: bold; }
        .note { font-style: italic; }
    </style>
    
    <!-- Background -->
    <rect width="800" height="600" fill="#ffffff"/>
    
    <!-- Participant boxes -->
    <g transform="translate(0, 20)">
        <rect x="50" y="0" width="100" height="40" fill="#ededed" stroke="#666"/>
        <text x="100" y="25" text-anchor="middle" class="participant">Library Component</text>
        
        <rect x="200" y="0" width="100" height="40" fill="#ededed" stroke="#666"/>
        <text x="250" y="25" text-anchor="middle" class="participant">StorageFactory</text>
        
        <rect x="350" y="0" width="100" height="40" fill="#ededed" stroke="#666"/>
        <text x="400" y="25" text-anchor="middle" class="participant">StorageProvider</text>
        
        <rect x="500" y="0" width="100" height="40" fill="#ededed" stroke="#666"/>
        <text x="550" y="25" text-anchor="middle" class="participant">API Routes</text>
        
        <rect x="650" y="0" width="100" height="40" fill="#ededed" stroke="#666"/>
        <text x="700" y="25" text-anchor="middle" class="participant">File System</text>
    </g>
    
    <!-- Lifelines -->
    <g stroke="#666" stroke-dasharray="5,5">
        <line x1="100" y1="60" x2="100" y2="550" />
        <line x1="250" y1="60" x2="250" y2="550" />
        <line x1="400" y1="60" x2="400" y2="550" />
        <line x1="550" y1="60" x2="550" y2="550" />
        <line x1="700" y1="60" x2="700" y2="550" />
    </g>
    
    <!-- Messages -->
    <g>
        <!-- Initialize Provider -->
        <line x1="100" y1="100" x2="250" y2="100" stroke="#666" marker-end="url(#arrow)"/>
        <text x="175" y="95" class="note">getProvider(libraryId)</text>
        
        <line x1="250" y1="130" x2="400" y2="130" stroke="#666" marker-end="url(#arrow)"/>
        <text x="325" y="125" class="note">create provider</text>
        
        <line x1="400" y1="160" x2="100" y2="160" stroke="#666" stroke-dasharray="5,5" marker-end="url(#arrow)"/>
        <text x="250" y="155" class="note">return provider</text>
        
        <!-- List Items -->
        <line x1="100" y1="220" x2="400" y2="220" stroke="#666" marker-end="url(#arrow)"/>
        <text x="250" y="215" class="note">listItemsById(folderId)</text>
        
        <line x1="400" y1="250" x2="550" y2="250" stroke="#666" marker-end="url(#arrow)"/>
        <text x="475" y="245" class="note">GET /api/storage/{type}</text>
        
        <line x1="550" y1="280" x2="700" y2="280" stroke="#666" marker-end="url(#arrow)"/>
        <text x="625" y="275" class="note">read directory</text>
        
        <line x1="700" y1="310" x2="550" y2="310" stroke="#666" stroke-dasharray="5,5" marker-end="url(#arrow)"/>
        <text x="625" y="305" class="note">return files</text>
        
        <line x1="550" y1="340" x2="400" y2="340" stroke="#666" stroke-dasharray="5,5" marker-end="url(#arrow)"/>
        <text x="475" y="335" class="note">return StorageItems</text>
        
        <line x1="400" y1="370" x2="100" y2="370" stroke="#666" stroke-dasharray="5,5" marker-end="url(#arrow)"/>
        <text x="250" y="365" class="note">update UI</text>
    </g>
    
    <!-- Arrow marker -->
    <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#666"/>
        </marker>
    </defs>
    
    <!-- Notes -->
    <g transform="translate(0, 400)">
        <rect x="50" y="0" width="700" height="60" fill="#f8f8f8" stroke="#666"/>
        <text x="400" y="25" text-anchor="middle" class="note">
            Similar flow for other operations (upload, delete, move)
        </text>
        <text x="400" y="45" text-anchor="middle" class="note">
            Provider abstracts storage implementation details
        </text>
    </g>
</svg>

1. **Initialisierung:**
   - Library Component lädt
   - StorageFactory erstellt Provider
   - Provider initialisiert Verbindung

2. **Dateilistenanfrage:**
   - UI-Event triggert listItemsById
   - Provider formatiert API-Anfrage
   - Backend verarbeitet Anfrage
   - Ergebnis wird durch Provider transformiert
   - UI aktualisiert sich

3. **Dateioperationen:**
   - UI-Event triggert Provider-Methode
   - Provider wandelt in API-Anfrage um
   - Backend führt Operation aus
   - Ergebnis wird zurück propagiert
   - UI-Status wird aktualisiert

## Provider-Implementierung

### Basis-Struktur für neue Provider:

```typescript
class CustomStorageProvider implements StorageProvider {
  constructor(config: ProviderConfig) {
    // Provider-spezifische Initialisierung
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    // 1. API-Anfrage an Speichersystem
    // 2. Transformation der Antwort in StorageItems
    // 3. Fehlerbehandlung
    // 4. Rückgabe standardisierter Daten
  }

  // Weitere Interface-Implementierungen...
}
```

## Ebenen und ihre Funktionen

1. **UI-Ebene (Frontend)**
   - Benutzerinteraktion
   - Status-Management
   - Datei-Vorschau
   - Drag & Drop

2. **Provider-Ebene (Frontend)**
   - Abstraktion der Speichersysteme
   - Einheitliche Schnittstelle
   - Caching
   - Fehlerbehandlung

3. **API-Ebene (Backend)**
   - Request-Handling
   - Authentifizierung
   - Dateisystem-Operationen
   - Fehler-Logging

4. **Storage-Ebene (Backend/External)**
   - Physische Dateispeicherung
   - Cloud-API-Integration
   - Metadaten-Management
   - Backup/Recovery