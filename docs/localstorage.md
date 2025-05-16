# FileSystem Storage Provider Dokumentation

## Übersicht

Der FileSystem Storage Provider ist einer der verfügbaren Storage-Provider in der Knowledge Scout Anwendung. Er ermöglicht den direkten Zugriff auf das lokale Dateisystem des Servers, auf dem die Anwendung ausgeführt wird. Dieser Provider bildet die Dateien und Ordner des lokalen Dateisystems auf die Anwendung ab und stellt sie über eine einheitliche API zur Verfügung.

## Architektur

Der FileSystem-Provider besteht aus mehreren Komponenten, die zusammenarbeiten:

### 1. Server-seitige Komponenten
- **FileSystemProvider**: Implementiert den direkten Zugriff auf das Dateisystem des Servers.
- **Storage Factory Server**: Erstellt und verwaltet die Provider-Instanzen auf Serverseite.

### 2. Client-seitige Komponenten
- **FileSystemClient**: Client-seitige Implementierung, die mit der Server-API kommuniziert.
- **Storage Factory Client**: Verwaltet die Provider-Instanzen auf Client-Seite.

### 3. Gemeinsame Komponenten
- **StorageProvider Interface**: Definiert die gemeinsame Schnittstelle für alle Storage-Provider.
- **StorageItem**: Repräsentiert Dateien und Ordner einheitlich.

## StorageProvider Interface

Alle Storage-Provider müssen das `StorageProvider`-Interface implementieren, das folgende Methoden definiert:

```typescript
interface StorageProvider {
  name: string;                               // Anzeigename des Providers
  id: string;                                 // Eindeutige Provider-ID
  
  validateConfiguration(): Promise<StorageValidationResult>; // Validiert die Konfiguration
  
  listItemsById(folderId: string): Promise<StorageItem[]>;  // Listet Dateien/Ordner auf
  
  getItemById(itemId: string): Promise<StorageItem>;        // Holt ein Element nach ID
  
  createFolder(parentId: string, name: string): Promise<StorageItem>; // Erstellt Ordner
  
  deleteItem(itemId: string): Promise<void>;                // Löscht Datei/Ordner
  
  moveItem(itemId: string, newParentId: string): Promise<void>; // Verschiebt Datei/Ordner
  
  uploadFile(parentId: string, file: File): Promise<StorageItem>; // Lädt Datei hoch
  
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }>; // Holt Binärdaten
  
  getPathById(itemId: string): Promise<string>;             // Ermittelt den Pfad einer Datei
}
```

## FileSystemProvider Implementierung

Die `FileSystemProvider`-Klasse implementiert das Interface für den direkten Zugriff auf das lokale Dateisystem:

### Besonderheiten

1. **ID-Generierung**: 
   - Stabile, eindeutige IDs für Dateien und Ordner
   - IDs werden aus Name, Größe, Zeitstempeln und bei Dateien zusätzlich aus einem Datei-Fingerprint generiert
   - IDs bleiben beim Verschieben erhalten

2. **Caching-Strategie**:
   - Bidirektionales Caching (Pfad → ID und ID → Pfad)
   - Automatische Cache-Aktualisierung bei Änderungen
   - Vermeidet wiederholte Hash-Berechnungen

### Kernfunktionen

- **generateFileId**: Erzeugt eine eindeutige ID für eine Datei/einen Ordner basierend auf ihren Eigenschaften.
- **findPathById**: Findet den Dateipfad zu einer gegebenen ID.
- **statsToStorageItem**: Konvertiert Filesystem-Statistiken in ein StorageItem-Objekt.

## FileSystemClient

Der `FileSystemClient` ist die clientseitige Implementierung, die API-Anfragen an den Server sendet:

### Merkmale

1. **Caching**: Implementiert clientseitiges Caching mit einer Ablaufzeit von 5 Sekunden.
2. **Fehlerbehandlung**: Einheitliche Fehlerbehandlung für Netzwerkanfragen.
3. **Bibliothek-Kontext**: Leitet alle Anfragen mit der LibraryId weiter.

## Konfiguration

### 1. Konfiguration in der Anwendung

Der FileSystem Storage Provider wird über die Oberfläche in den Einstellungen konfiguriert:

1. **Bibliothekseinstellungen**:
   - Gehen Sie zu "Einstellungen" → "Bibliothek"
   - Wählen Sie "Lokales Dateisystem" als Storage-Typ
   - Geben Sie den absoluten Pfad zum gewünschten Verzeichnis an

```typescript
// Beispiel-Konfiguration
{
  type: "local",
  path: "/data/documents", // Unter Linux/Mac
  // ODER
  path: "C:\\Dokumente\\Bibliothek", // Unter Windows
}
```

### 2. Berechtigungen

- Der Server benötigt Lese- und Schreibrechte auf das angegebene Verzeichnis.
- Bei Windows müssen Sie möglicherweise Pfade mit doppelten Backslashes (`\\`) angeben.
- Das Verzeichnis muss existieren, bevor es verwendet werden kann.

## Integration mit der Benutzeroberfläche

### StorageForm-Komponente

Die `StorageForm`-Komponente (`src/components/settings/storage-form.tsx`) dient zur Konfiguration des Storage-Providers:

```typescript
// Auszug aus storage-form.tsx
const storageFormSchema = z.object({
  type: z.enum(["local", "onedrive", "gdrive"], {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  // Weitere Konfigurationsfelder
});
```

### LibraryForm-Komponente

Die `LibraryForm`-Komponente (`src/components/settings/library-form.tsx`) ermöglicht das Erstellen und Bearbeiten von Bibliotheken mit verschiedenen Storage-Providern:

```typescript
// Bibliotheksobjekt mit Storage-Konfiguration
const libraryData = {
  id: isNew ? uuidv4() : activeLibraryId,
  label: data.label,
  path: data.path,
  type: data.type as StorageProviderType,
  isEnabled: data.isEnabled,
  // Storage-spezifische Konfiguration
  config: {
    description: data.description,
    // Für lokales Dateisystem
    basePath: data.storageConfig.basePath,
  }
};
```

## Storage Factory

Die `StorageFactory`-Klasse ist verantwortlich für die Erstellung und Verwaltung von Storage-Provider-Instanzen:

### Funktionen

1. **Singleton-Pattern**: Stellt sicher, dass nur eine Instanz der Factory existiert.
2. **Provider-Cache**: Speichert Provider-Instanzen für wiederholte Verwendung.
3. **Dynamische Provider-Erstellung**: Erstellt Provider basierend auf der Bibliothekskonfiguration.

```typescript
// Auszug aus storage-factory.ts
async getProvider(libraryId: string): Promise<StorageProvider> {
  // Provider aus dem Cache holen oder neu erstellen
  if (this.providers.has(libraryId)) {
    return this.providers.get(libraryId)!;
  }

  const library = this.libraries.find(lib => lib.id === libraryId);
  if (!library) {
    throw new Error(`Bibliothek ${libraryId} nicht gefunden`);
  }

  // Provider basierend auf Bibliothekstyp erstellen
  let provider: StorageProvider;
  switch (library.type) {
    case 'local':
      provider = new LocalStorageProvider(library);
      break;
    default:
      throw new Error(`Nicht unterstützter Bibliothekstyp: ${library.type}`);
  }

  this.providers.set(libraryId, provider);
  return provider;
}
```

## Beispiel: Vollständiger Ablauf

1. **Bibliothek konfigurieren**:
   - Benutzer erstellt eine neue Bibliothek vom Typ "local"
   - Pfad zu einem lokalen Verzeichnis wird konfiguriert

2. **Library-Komponente initialisieren**:
   - Beim Laden der Library-Komponente wird der StorageContext initialisiert
   - Die StorageFactory erstellt eine FileSystemProvider-Instanz

3. **Dateien auflisten**:
   - Die Library-Komponente ruft `listItemsById('root')` auf
   - Der FileSystemClient sendet eine API-Anfrage an den Server
   - Der Server verwendet den FileSystemProvider für den Zugriff auf das Dateisystem
   - Die Ergebnisse werden in der Benutzeroberfläche angezeigt

4. **Datei hochladen**:
   - Benutzer wählt eine Datei aus und startet den Upload
   - Der FileSystemClient sendet die Datei an die API
   - Der Server speichert die Datei im konfigurierten Verzeichnis
   - Der Cache wird aktualisiert, und die neue Datei wird angezeigt

## Fehlerbehandlung

Der FileSystem-Provider implementiert eine robuste Fehlerbehandlung:

- **StorageError-Klasse**: Spezifische Fehlerklasse mit Code- und Provider-Informationen
- **Validierung**: Prüft, ob das konfigurierte Verzeichnis existiert und zugänglich ist
- **Benutzerfreundliche Fehlermeldungen**: Probleme werden dem Benutzer verständlich angezeigt

```typescript
// Beispiel für Fehlerbehandlung
class StorageError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public provider: string = 'unknown'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
```

## Implementierung eines neuen Storage-Providers

Um einen neuen Storage-Provider zu erstellen, müssen folgende Schritte durchgeführt werden:

1. **Provider-Klasse erstellen**:
   - Implementieren Sie das StorageProvider-Interface
   - Implementieren Sie alle erforderlichen Methoden

2. **Client-seitige Komponente erstellen**:
   - Implementieren Sie einen Client, der mit Ihrer Provider-API kommuniziert

3. **In die StorageFactory integrieren**:
   - Fügen Sie den neuen Provider-Typ zur StorageFactory hinzu
   - Ergänzen Sie die entsprechenden UI-Elemente für die Konfiguration

4. **API-Route erweitern**:
   - Erstellen oder erweitern Sie eine API-Route für den neuen Provider-Typ

5. **Benutzeroberfläche anpassen**:
   - Aktualisieren Sie die Formularkomponenten für die Konfiguration
   - Fügen Sie neue Validierungsregeln hinzu

## Zusammenfassung

Der FileSystem Storage Provider ermöglicht den direkten Zugriff auf das lokale Dateisystem des Servers. Er implementiert das StorageProvider-Interface und bietet ein robustes System für die ID-Generierung und das Caching. Die Provider-Architektur ermöglicht es, verschiedene Speichersysteme unter einer einheitlichen API zu abstrahieren, wodurch die Anwendung flexibel und erweiterbar wird.

Als Vorlage für einen neuen Provider bietet diese Implementierung eine solide Grundlage und demonstriert die wichtigsten Aspekte, die in einem Storage-Provider berücksichtigt werden müssen. 