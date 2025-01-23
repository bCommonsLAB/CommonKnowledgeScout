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

Die Metadaten-Struktur ist hierarchisch aufgebaut und besteht aus verschiedenen spezialisierten Interfaces. Hier ist eine detaillierte Erklärung der verschiedenen Typen:

### 1. BaseMetadata - Die Grundlage
Die Basis-Schnittstelle, von der andere Metadaten-Typen erben. Sie enthält die grundlegendsten Informationen:
```typescript
interface BaseMetadata {
  type: string;    // Art der Metadaten
  created: string; // Erstellungszeitpunkt
  modified: string; // Letzter Änderungszeitpunkt
}
```

### 2. TechnicalMetadata - Technische Informationen
Diese Metadaten werden automatisch aus der Datei selbst extrahiert und enthalten technische Details über das Medium:
```typescript
interface TechnicalMetadata extends BaseMetadata {
  file_size: number;           // Dateigröße in Bytes
  file_mime: string;           // Dateityp (z.B. audio/mp3)
  file_extension: string;      // Dateiendung
  
  // Medienspezifische Details
  media_duration?: number;     // Länge des Mediums in Sekunden
  media_bitrate?: number;      // Bitrate in kbps
  media_codec?: string;        // Verwendeter Codec
  media_resolution?: string;   // Auflösung (bei Video, z.B. "1920x1080")
  media_format?: string;       // Medienformat (z.B. "MP3", "H.264")
  media_channels?: number;     // Anzahl der Audiokanäle
  media_samplerate?: number;   // Abtastrate in Hz
  
  // Bildspezifische Details (für Bilder und Videos)
  image_width?: number;        // Bildbreite in Pixeln
  image_height?: number;       // Bildhöhe in Pixeln
  image_colorspace?: string;   // Farbraum (z.B. "RGB", "CMYK")
  image_dpi?: number;         // Auflösung in DPI
  
  // Dokumentspezifische Details (für PDFs, etc.)
  doc_pages?: number;         // Anzahl der Seiten
  doc_wordcount?: number;     // Anzahl der Wörter
  doc_software?: string;      // Erstellungssoftware
  doc_encrypted?: boolean;    // Verschlüsselungsstatus
}
```

Beispiel für die YAML-Darstellung der technischen Metadaten:
```yaml
# Technische Metadaten
file_size: 15728640          # 15 MB
file_mime: "audio/mp3"
file_extension: "mp3"

# Medienspezifische Details
media_duration: 1800         # 30 Minuten
media_bitrate: 320          # 320 kbps
media_codec: "MP3"
media_channels: 2
media_samplerate: 44100     # 44.1 kHz
```

### 3. ContentMetadata - Inhaltliche Informationen
Diese Metadaten werden als flache YAML-Struktur im Header von Markdown-Dateien gespeichert:
```typescript
interface ContentMetadata extends BaseMetadata {
  // Bibliographische Grunddaten
  title: string;                    // Haupttitel des Werks
  subtitle?: string;                // Untertitel
  authors: string[];                // Autor(en)
  publisher?: string;               // Verlag
  publicationDate?: string;         // Erscheinungsdatum
  isbn?: string;                    // ISBN (bei Büchern)
  doi?: string;                     // Digital Object Identifier
  edition?: string;                 // Auflage
  language: string;                 // Sprache (ISO 639-1)
  
  // Wissenschaftliche Klassifikation
  subject_areas?: string[];         // Fachgebiete (z.B. "Biologie", "Ökologie")
  keywords?: string[];              // Schlüsselwörter
  abstract?: string;                // Kurzzusammenfassung
  
  // Räumliche und zeitliche Einordnung
  temporal_start?: string;          // Beginn des behandelten Zeitraums
  temporal_end?: string;            // Ende des behandelten Zeitraums
  temporal_period?: string;         // Bezeichnung der Periode (z.B. "Holozän")
  spatial_location?: string;        // Ortsname
  spatial_latitude?: number;        // Geografische Breite
  spatial_longitude?: number;       // Geografische Länge
  spatial_habitat?: string;         // Lebensraum/Biotop
  spatial_region?: string;          // Region/Gebiet
  
  // Rechte und Lizenzen
  rights_holder?: string;           // Rechteinhaber
  rights_license?: string;          // Lizenz (z.B. "CC BY-SA 4.0")
  rights_access?: string;           // Zugriffsrechte
  
  // Medienspezifische Metadaten
  resource_type: string;            // Art der Ressource (z.B. "Book", "Video", "Audio")
  resource_format?: string;         // Physisches/digitales Format
  resource_extent?: string;         // Umfang (z.B. "342 Seiten", "45 Minuten")
  
  // Quellenangaben
  source_title?: string;            // Titel der Quelle
  source_type?: string;            // Art der Quelle
  source_identifier?: string;       // Eindeutige Kennung der Quelle
  
  // Digitale Plattform
  platform_type?: string;           // Art der Plattform (z.B. "youtube", "vimeo")
  platform_url?: string;            // URL zur Ressource
  platform_id?: string;             // Plattform-spezifische ID
  platform_uploader?: string;       // Uploader/Kanal
  
  // Wissenschaftliche Zusatzinformationen
  citations?: string[];             // Zitierte Werke
  methodology?: string;             // Verwendete Methodik
  funding?: string;                 // Förderung/Finanzierung
  
  // Verwaltung
  collection?: string;              // Zugehörige Sammlung
  archival_number?: string;         // Archivnummer
  status?: string;                  // Status (z.B. "verified", "draft")
}
```

Beispiel für die YAML-Darstellung im Markdown:
```yaml
---
# Bibliographische Grunddaten
title: "Ökosysteme der Nordsee"
subtitle: "Eine Bestandsaufnahme"
authors: 
  - "Dr. Maria Schmidt"
  - "Prof. Hans Meyer"
publisher: "Wissenschaftsverlag"
publicationDate: "2023-05-15"
isbn: "978-3-12345-678-9"
language: "de"

# Wissenschaftliche Klassifikation
subject_areas: 
  - "Meeresbiologie"
  - "Ökologie"
keywords:
  - "Nordsee"
  - "Wattenmeer"
  - "Biodiversität"
abstract: "Eine umfassende Analyse der Ökosysteme im Wattenmeer..."

# Räumliche und zeitliche Einordnung
temporal_start: "2020-01"
temporal_end: "2022-12"
spatial_location: "Sylt"
spatial_latitude: 54.8985
spatial_longitude: 8.3125
spatial_habitat: "Wattenmeer"
spatial_region: "Nordsee"

# Rechte und Lizenzen
rights_holder: "Wissenschaftsverlag GmbH"
rights_license: "CC BY-SA 4.0"

# Medienspezifische Metadaten
resource_type: "Book"
resource_format: "PDF"
resource_extent: "342 Seiten"

# Verwaltung
collection: "Meeresökologie"
status: "verified"
---
```

Diese flache Struktur:
1. Ist einfach als YAML zu speichern und zu lesen
2. Behält die logische Gruppierung durch Präfixe bei
3. Ist leicht erweiterbar
4. Bleibt übersichtlich in Markdown-Editoren
5. Lässt sich einfach validieren und parsen

### 4. ExtendedFileMetadata - Vollständige Metadaten
Dies ist die umfassendste Metadaten-Struktur, die alle anderen Typen zusammenführt und zusätzliche Informationen über verknüpfte Dateien (Twins) enthält:
```typescript
interface ExtendedFileMetadata {
  name: string;        // Dateiname
  size: number;        // Größe
  modifiedAt: string;  // Änderungsdatum
  
  metadata: {          // Kombinierte Metadaten
    technical: TechnicalMetadata;
    content?: ContentMetadata;
  };
  
  twins?: {            // Verweise auf zugehörige Dateien
    transcript?: {     // Transkript
      id: string;
      path: string;
      content?: string;
    };
    summary?: {        // Zusammenfassung
      id: string;
      path: string;
      content?: string;
    };
  };
  
  // Status-Flags für die UI
  hasTranscript: boolean;
  hasSummary: boolean;
  hasMetadata: boolean;
  isTranscript: boolean;
  isSummary: boolean;
}
```

Diese Struktur ermöglicht:
1. Dateien technisch korrekt zu verarbeiten
2. Inhalte sinnvoll zu kategorisieren und zu durchsuchen
3. Zusammengehörige Dateien (Original, Transkript, Zusammenfassung) zu verwalten
4. Die UI entsprechend zu steuern (z.B. welche Vorschau-Tabs angezeigt werden)

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

## Metadaten-Mapping Beispiele

### YouTube-Video Mapping
Hier ein Beispiel, wie YouTube-Metadaten auf unsere Struktur abgebildet werden:

```yaml
---
# Bibliographische Grunddaten
title: "{{title}}"                    # Titel des Videos
authors: 
  - "{{uploader}}"                    # YouTube Uploader als Autor
publicationDate: "{{upload_date}}"    # Upload-Datum
language: "de"                        # Sprache des Videos

# Wissenschaftliche Klassifikation
keywords: "{{tags}}"                  # YouTube Tags
subject_areas: 
  - "{{categories}}"                  # YouTube Kategorie

# Räumliche Einordnung
spatial_location: "{{ort}}"           # Erwähnter/gezeigter Ort

# Personen
persons: "{{personen}}"               # Erwähnte Personen

# Digitale Plattform
platform_type: "youtube"              # Plattform-Typ
platform_url: "https://www.youtube.com/watch?v={{video_id}}"  # Video-URL
platform_id: "{{video_id}}"           # YouTube Video-ID
platform_uploader: "{{uploader}}"     # Kanal/Uploader
platform_thumbnail: "https://img.youtube.com/vi/{{video_id}}/hqdefault.jpg"  # Thumbnail

# Medienspezifische Metadaten
resource_type: "Video"                # Art der Ressource
resource_format: "YouTube Video"      # Format

# Verwaltung
status: "verified"                    # Status
---
```

Beispiel mit echten Daten:
```yaml
---
# Bibliographische Grunddaten
title: "Klimawandel in der Nordsee"
authors: 
  - "WissenschaftsKanal"
publicationDate: "2023-05-15"
language: "de"

# Wissenschaftliche Klassifikation
keywords:
  - "Klimawandel"
  - "Nordsee"
  - "Meeresbiologie"
  - "Umweltschutz"
subject_areas: 
  - "Wissenschaft & Bildung"

# Räumliche Einordnung
spatial_location: "Nordsee"

# Personen
persons:
  - "Dr. Maria Schmidt"
  - "Prof. Hans Meyer"

# Digitale Plattform
platform_type: "youtube"
platform_url: "https://www.youtube.com/watch?v=abc123xyz"
platform_id: "abc123xyz"
platform_uploader: "WissenschaftsKanal"
platform_thumbnail: "https://img.youtube.com/vi/abc123xyz/hqdefault.jpg"

# Medienspezifische Metadaten
resource_type: "Video"
resource_format: "YouTube Video"

# Verwaltung
status: "verified"
---
```

Die technischen Metadaten würden automatisch extrahiert:
```yaml
# Technische Metadaten
file_size: 256000000          # 256 MB
file_mime: "video/mp4"
file_extension: "mp4"

# Medienspezifische Details
media_duration: 1800          # 30 Minuten
media_resolution: "1920x1080" # Full HD
media_codec: "H.264"
media_format: "MP4"
```

Diese Struktur:
1. Behält alle wichtigen YouTube-Metadaten
2. Ordnet sie logisch in unsere Kategorien ein
3. Ergänzt sie um technische Details
4. Ermöglicht einheitliche Verarbeitung mit anderen Medientypen

// ... existing code ... 