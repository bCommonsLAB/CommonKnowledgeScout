# Erweitertes Shadow-Twin Feature

## Konzeptübersicht

Das erweiterte Shadow-Twin Feature unterscheidet zwischen Transkriptionen und Zusammenfassungen von Mediendateien und ermöglicht eine strukturierte Verwaltung dieser Begleitdokumente.

### Dateistruktur

```
beispiel/
  ├── interview.mp3          # Original Mediendatei
  ├── interview.md          # Zusammenfassung (Summary + Metadaten)
  └── interview-transcript.md # Transkription
```

## Namenskonventionen

| Dateityp | Namenskonvention | Beispiel | Zweck |
|----------|------------------|----------|--------|
| Original | `{name}.{ext}` | `lecture.mp3` | Originale Mediendatei |
| Summary | `{name}.md` | `lecture.md` | KI-generierte Zusammenfassung und Metadaten|
| Transcript | `{name}-transcript.md` | `lecture-transcript.md` | Originalgetreue Transkription |

## Metadaten-Struktur

### 1. Basis-Metadaten Interface
```typescript
interface BaseMetadata {
  type: string;
  created: string;
  modified: string;
}

// Technische Metadaten (aus der Datei)
interface TechnicalMetadata extends BaseMetadata {
  size: number;
  mimeType: string;
  extension: string;
  mediaInfo?: {
    duration?: number;
    bitrate?: number;
    codec?: string;
    resolution?: string;
    format?: string;
    channels?: number;
    sampleRate?: number;
  };
}

// Inhaltliche Metadaten (aus YAML)
interface ContentMetadata extends BaseMetadata {
  title?: string;
  description?: string;
  language?: string;
  tags?: string[];
  persons?: string[];
  date?: string;
  location?: string;
  topics?: string[];
  keywords?: string[];
  // Plattform-spezifische Metadaten
  platform?: {
    type?: 'youtube' | 'vimeo' | 'local' | string;
    url?: string;
    thumbnail?: string;
    id?: string;
    uploader?: string;
    category?: string;
  };
}

// Erweiterte Datei-Metadaten
interface ExtendedFileMetadata {
  // Bestehende Metadaten
  name: string;
  size: number;
  modifiedAt: string;
  
  // Strukturierte Metadaten
  metadata: {
    technical: TechnicalMetadata;
    content?: ContentMetadata;
  };
  
  // Twin-Referenzen bleiben unverändert
  twins?: {
    transcript?: {
      id: string;
      path: string;
      content?: string;
    };
    summary?: {
      id: string;
      path: string;
      content?: string;
    };
  };
  
  // UI Flags
  hasTranscript: boolean;
  hasSummary: boolean;
  hasMetadata: boolean;
  isTranscript: boolean;
  isSummary: boolean;
}

// Metadaten-Extraktion
class MetadataExtractor {
  // Extrahiert technische Metadaten aus der Datei
  async extractTechnicalMetadata(file: StorageItem): Promise<TechnicalMetadata> {
    // Implementation
    return {
      type: 'technical',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      size: file.size,
      mimeType: file.type,
      extension: file.name.split('.').pop() || '',
      // Medienspezifische Informationen werden bei Bedarf hinzugefügt
    };
  }

  // Extrahiert YAML Metadaten aus der Summary-Datei
  async extractContentMetadata(summaryFile: StorageItem): Promise<ContentMetadata | null> {
    try {
      const content = await readFile(summaryFile.path);
      const yamlContent = content.split('---')[1];
      const parsed = yaml.parse(yamlContent);
      
      return {
        type: 'content',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        ...parsed
      };
    } catch (error) {
      console.error('Failed to extract content metadata:', error);
      return null;
    }
  }
}

// Beispiel für die Twin-Erkennung mit erweiterten Metadaten
async function processTwins(items: StorageItem[]): Promise<ExtendedFileMetadata[]> {
  const extractor = new MetadataExtractor();
  const result: ExtendedFileMetadata[] = [];
  
  for (const item of items) {
    const metadata: ExtendedFileMetadata = {
      name: item.name,
      size: item.size,
      modifiedAt: item.modifiedAt,
      metadata: {
        technical: await extractor.extractTechnicalMetadata(item)
      },
      hasTranscript: false,
      hasSummary: false,
      hasMetadata: false,
      isTranscript: false,
      isSummary: false
    };

    // Finde zugehörige Twins
    const baseName = getBaseName(item.name);
    const summary = items.find(i => i.name === `${baseName}.md`);
    const transcript = items.find(i => i.name === `${baseName}-transcript.md`);

    if (summary || transcript) {
      metadata.twins = {};
      
      if (summary) {
        metadata.twins.summary = {
          id: summary.id,
          path: summary.path
        };
        metadata.hasSummary = true;
        
        // Extrahiere Content Metadaten aus Summary
        const contentMetadata = await extractor.extractContentMetadata(summary);
        if (contentMetadata) {
          metadata.metadata.content = contentMetadata;
          metadata.hasMetadata = true;
        }
      }

      if (transcript) {
        metadata.twins.transcript = {
          id: transcript.id,
          path: transcript.path
        };
        metadata.hasTranscript = true;
      }
    }

    result.push(metadata);
  }

  return result;
}
```

## Technische Implementation

### 1. Erweiterte Metadaten-Struktur

```typescript
interface YAMLMetadata {
  type: 'summary' | 'transcript';
  source: string;
  language: string;
  created: string;
  model: string;
  quality?: number;
  wordCount: number;
  duration: number;
  topics?: string[];
  keywords?: string[];
}

interface ExtendedFileMetadata {
  // Bestehende Metadaten
  name: string;
  size: number;
  modifiedAt: string;
  
  // Neue Metadaten
  twins?: {
    transcript?: {
      id: string;
      path: string;
      content?: string;
    };
    summary?: {
      id: string;
      path: string;
      content?: string;
    };
    metadata?: YAMLMetadata; // YAML Metadaten aus der Summary-Datei
  };
  
  // Flags für UI
  hasTranscript: boolean;
  hasSummary: boolean;
  hasMetadata: boolean;
  isTranscript: boolean;
  isSummary: boolean;
}

// Beispiel für die Metadaten-Extraktion
async function extractMetadata(summaryFile: StorageItem): Promise<YAMLMetadata | null> {
  try {
    const content = await readFile(summaryFile.path);
    const yamlContent = content.split('---')[1]; // Extrahiert YAML zwischen den Markern
    return yaml.parse(yamlContent);
  } catch (error) {
    console.error('Failed to extract metadata:', error);
    return null;
  }
}

// Beispiel für die Twin-Erkennung mit Metadaten
async function processTwins(items: StorageItem[]): Promise<ExtendedFileMetadata[]> {
  const result: ExtendedFileMetadata[] = [];
  
  for (const item of items) {
    const metadata: ExtendedFileMetadata = {
      name: item.name,
      size: item.size,
      modifiedAt: item.modifiedAt,
      hasTranscript: false,
      hasSummary: false,
      hasMetadata: false,
      isTranscript: false,
      isSummary: false
    };

    // Finde zugehörige Twins
    const baseName = getBaseName(item.name);
    const summary = items.find(i => i.name === `${baseName}.md`);
    const transcript = items.find(i => i.name === `${baseName}-transcript.md`);

    if (summary || transcript) {
      metadata.twins = {};
      
      // Wenn Summary existiert, extrahiere Metadaten
      if (summary) {
        metadata.twins.summary = {
          id: summary.id,
          path: summary.path
        };
        metadata.hasSummary = true;
        
        // Extrahiere YAML Metadaten aus Summary
        const yamlMetadata = await extractMetadata(summary);
        if (yamlMetadata) {
          metadata.twins.metadata = yamlMetadata;
          metadata.hasMetadata = true;
        }
      }

      // Wenn Transcript existiert
      if (transcript) {
        metadata.twins.transcript = {
          id: transcript.id,
          path: transcript.path
        };
        metadata.hasTranscript = true;
      }
    }

    result.push(metadata);
  }

  return result;
}
```

### 2. Erweiterter Twin-Hook

```typescript
interface TwinFiles {
  original: StorageItem;
  transcript?: StorageItem;
  summary?: StorageItem;
  metadata?: YAMLMetadata;
}

function useExtendedTwins(
  items: StorageItem[], 
  enabled: boolean
): TwinFiles[] {
  // Implementation mit Metadaten-Extraktion
}
```

## UI-Komponenten

### 1. Erweiterte Dateiliste

```typescript
interface FileListItemProps {
  item: StorageItem;
  twins: TwinFiles;
  icons: {
    hasTranscript: ReactNode;
    hasSummary: ReactNode;
    hasMetadata: ReactNode;
  };
}
```

Beispiel-Implementation:
```tsx
<FileListItem>
  <FileIcon type={item.type} />
  <FileName>{item.name}</FileName>
  <TwinIndicators>
    {item.hasTranscript && <TranscriptIcon />}
    {item.hasSummary && <SummaryIcon />}
    {item.hasMetadata && <MetadataIcon />}
  </TwinIndicators>
</FileListItem>
```

### 2. Erweiterte Vorschau

```tsx
interface FilePreviewProps {
  item: StorageItem;
  twins: TwinFiles;
}

const FilePreview: React.FC<FilePreviewProps> = ({ item, twins }) => {
  return (
    <Tabs defaultValue="preview">
      <TabsList>
        <TabsTrigger value="preview">Vorschau</TabsTrigger>
        <TabsTrigger 
          value="metadata" 
          disabled={!item.hasMetadata}
        >
          Metadaten
        </TabsTrigger>
        <TabsTrigger 
          value="transcript" 
          disabled={!twins.transcript}
        >
          Transkript
        </TabsTrigger>
        <TabsTrigger 
          value="summary" 
          disabled={!twins.summary}
        >
          Zusammenfassung
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="preview">
        <MediaPreview item={item} />
      </TabsContent>
      
      <TabsContent value="metadata">
        <MetadataView metadata={item.metadata} />
      </TabsContent>
      
      <TabsContent value="transcript">
        <MarkdownPreview content={twins.transcript?.content} />
      </TabsContent>
      
      <TabsContent value="summary">
        <MarkdownPreview content={twins.summary?.content} />
      </TabsContent>
    </Tabs>
  );
};
```

## Implementierungsschritte

1. **Basisstruktur (Sprint 1)**
   - Erweitern der Metadaten-Interfaces
   - Anpassen der Namenskonventionen
   - Implementierung des YAML-Parsers für Markdown-Header

2. **Backend-Logik (Sprint 1)**
   - Erweiterung des Twin-Detection-Systems
   - Implementation der Gruppierungslogik
   - Entwicklung der Metadaten-Extraktion

3. **UI-Komponenten (Sprint 2)**
   - Anpassung der Dateiliste mit Icons
   - Entwicklung der gruppierten Darstellung
   - Implementation der erweiterten Vorschau-Tabs

4. **Vorschau-System (Sprint 2)**
   - Entwicklung der Tab-Navigation
   - Implementation der Markdown-Vorschau
   - Integration der Metadaten-Anzeige

5. **Tests und Dokumentation (Sprint 3)**
   - Unit-Tests für neue Funktionen
   - Integration-Tests für UI-Komponenten
   - Aktualisierung der Dokumentation
   - Erstellen von Beispielen

## Technische Abhängigkeiten

- `yaml` für YAML-Parsing
- `@radix-ui/react-tabs` für Tab-Navigation
- `lucide-react` für Icons
- `react-markdown` für Markdown-Rendering

## Migration

1. **Datenstruktur**
   - Bestehende Twins identifizieren
   - Umbenennung nach neuer Konvention
   - Metadaten-Header hinzufügen

2. **Konfiguration**
   - Anpassung der Library-Konfiguration
   - Update der Twin-Detection-Logik

## Qualitätssicherung

1. **Tests**
   - Unit-Tests für Namenskonventionen
   - Integration-Tests für UI
   - E2E-Tests für Workflow

2. **Performance**
   - Lazy Loading für Twins
   - Caching von Metadaten
   - Optimierte Gruppierung

3. **Accessibility**
   - ARIA-Labels für Icons
   - Keyboard-Navigation
   - Screen-Reader-Support

## Nächste Schritte

1. Review des Konzepts mit dem Team
2. Priorisierung der Implementierungsschritte
3. Erstellung der ersten User Stories
4. Setup der Entwicklungsumgebung
5. Beginn mit Sprint 1 

## MongoDB Integration (Phase 2)

Die bestehende Metadaten-Struktur wurde so designed, dass sie einfach in MongoDB migriert werden kann.

### Datenbankschema

```typescript
// MongoDB Schema für Metadaten
interface MetadataDocument extends ExtendedFileMetadata {
  _id: ObjectId;              // MongoDB ID
  sourceId: string;           // Original Datei-ID
  path: string;              // Dateipfad
  libraryId: string;         // Zugehörige Bibliothek
  indexed: boolean;          // Indizierungsstatus
  lastIndexed?: Date;        // Letzter Index-Zeitpunkt
}

// Indizes für effiziente Suche
const mongoIndexes = {
  // Basis-Indizes
  'metadata.technical.mimeType': 1,
  'metadata.technical.size': 1,
  'metadata.content.language': 1,
  'metadata.content.date': 1,
  
  // Array-Indizes
  'metadata.content.tags': 1,
  'metadata.content.persons': 1,
  'metadata.content.topics': 1,
  
  // Compound-Indizes für häufige Abfragen
  commonQueries: {
    libraryId: 1,
    'metadata.content.language': 1,
    'metadata.technical.mimeType': 1
  }
};
```

### Migrations-Strategie

1. **Vorbereitungsphase**
```typescript
interface MigrationConfig {
  batchSize: number;
  parallel: boolean;
  validateData: boolean;
}

class MetadataMigration {
  constructor(
    private source: MetadataExtractor,
    private target: MongoDB,
    private config: MigrationConfig
  ) {}

  // Schrittweise Migration
  async migrateInBatches(items: StorageItem[]) {
    const batches = chunk(items, this.config.batchSize);
    
    for (const batch of batches) {
      const metadata = await this.source.processTwins(batch);
      await this.target.insertMany(
        metadata.map(this.transformToMongoDocument)
      );
    }
  }

  // Transformation in MongoDB-Format
  private transformToMongoDocument(
    metadata: ExtendedFileMetadata
  ): MetadataDocument {
    return {
      ...metadata,
      _id: new ObjectId(),
      sourceId: metadata.name,
      path: metadata.twins?.summary?.path || '',
      libraryId: getCurrentLibraryId(),
      indexed: true,
      lastIndexed: new Date()
    };
  }
}
```

2. **Synchronisations-Strategie**
```typescript
class MetadataSync {
  // Prüft auf Änderungen
  async checkForChanges(item: StorageItem): Promise<boolean> {
    const stored = await this.mongodb.findOne({ sourceId: item.id });
    if (!stored) return true;
    
    return stored.modifiedAt !== item.modifiedAt;
  }

  // Aktualisiert Metadaten
  async syncMetadata(item: StorageItem) {
    if (await this.checkForChanges(item)) {
      const metadata = await this.extractor.processTwins([item]);
      await this.mongodb.updateOne(
        { sourceId: item.id },
        { $set: metadata[0] },
        { upsert: true }
      );
    }
  }
}
```

### Erweiterter MetadataService

```typescript
class MetadataService {
  constructor(
    private extractor: MetadataExtractor,
    private mongodb?: MongoDB
  ) {}

  // Holt Metadaten mit Fallback
  async getMetadata(item: StorageItem): Promise<ExtendedFileMetadata> {
    // Versuche zuerst MongoDB wenn verfügbar
    if (this.mongodb) {
      const stored = await this.mongodb.findOne({ sourceId: item.id });
      if (stored) return stored;
    }
    
    // Fallback zur direkten Extraktion
    const metadata = await this.extractor.processTwins([item]);
    return metadata[0];
  }

  // Speichert Metadaten wenn MongoDB verfügbar
  async saveMetadata(metadata: ExtendedFileMetadata) {
    if (this.mongodb) {
      await this.mongodb.updateOne(
        { sourceId: metadata.name },
        { $set: metadata },
        { upsert: true }
      );
    }
  }
}
```

### Suchfunktionen

```typescript
interface SearchQuery {
  mimeType?: string[];
  tags?: string[];
  persons?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  language?: string;
  fulltext?: string;
}

class MetadataSearch {
  async search(query: SearchQuery): Promise<ExtendedFileMetadata[]> {
    if (!this.mongodb) {
      throw new Error('Search requires MongoDB');
    }

    const filter: any = { libraryId: getCurrentLibraryId() };

    if (query.mimeType?.length) {
      filter['metadata.technical.mimeType'] = { $in: query.mimeType };
    }

    if (query.tags?.length) {
      filter['metadata.content.tags'] = { $all: query.tags };
    }

    if (query.dateRange) {
      filter['metadata.content.date'] = {
        $gte: query.dateRange.start,
        $lte: query.dateRange.end
      };
    }

    return await this.mongodb.find(filter);
  }
}
```

### Integration in bestehende Komponenten

1. **Hook Anpassung**
```typescript
function useExtendedTwins(
  items: StorageItem[], 
  enabled: boolean
): TwinFiles[] {
  const metadataService = useMetadataService();
  
  // Implementation bleibt gleich, nutzt aber MetadataService
  // für Zugriff auf gespeicherte Metadaten
}
```

2. **UI Komponenten**
```typescript
const MetadataView: React.FC<{ item: StorageItem }> = ({ item }) => {
  const { metadata, loading } = useMetadata(item);
  
  if (loading) return <Spinner />;
  
  return (
    <Tabs defaultValue="technical">
      <TabsList>
        <TabsTrigger value="technical">
          Technische Metadaten
        </TabsTrigger>
        <TabsTrigger 
          value="content" 
          disabled={!metadata.metadata.content}
        >
          Inhaltliche Metadaten
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="technical">
        <TechnicalMetadataView data={metadata.metadata.technical} />
      </TabsContent>
      
      <TabsContent value="content">
        <ContentMetadataView data={metadata.metadata.content} />
      </TabsContent>
    </Tabs>
  );
};
```

### Migrations-Schritte

1. **Vorbereitung**
   - MongoDB Setup und Konfiguration
   - Schema-Validierung einrichten
   - Indizes erstellen

2. **Test-Migration**
   - Kleine Datenmenge migrieren
   - Validierung der Daten
   - Performance-Tests

3. **Vollständige Migration**
   - Batch-weise Migration
   - Fortschritts-Monitoring
   - Fehlerbehandlung

4. **Validierung**
   - Datenintegrität prüfen
   - Performance-Messungen
   - UI-Tests

5. **Umschaltung**
   - Gradueller Übergang zu MongoDB
   - Fallback-Mechanismus
   - Monitoring

### Vorteile der MongoDB-Integration

1. **Performance**
   - Schnelle Suche durch Indizierung
   - Effiziente Filterung
   - Caching-Möglichkeiten

2. **Skalierbarkeit**
   - Wachsende Datenmengen
   - Verteilte Suche
   - Replikation

3. **Funktionalität**
   - Erweiterte Suchmöglichkeiten
   - Aggregationen
   - Statistiken

4. **Wartbarkeit**
   - Zentrale Datenhaltung
   - Einfachere Updates
   - Besseres Monitoring 