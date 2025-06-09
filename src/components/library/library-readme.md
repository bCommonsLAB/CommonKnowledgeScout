# Library Components Documentation

## Überblick

Die Library-Komponenten bilden das Herzstück der Dateiverwaltung in Knowledge Scout. Sie ermöglichen es Benutzern, ihre Dateien über verschiedene Storage-Provider (OneDrive, lokales Dateisystem) zu verwalten, anzuzeigen und zu transformieren.

## Inhaltsverzeichnis

1. [Architektur](#architektur)
2. [Tech Stack](#tech-stack)
3. [Komponenten-Übersicht](#komponenten-übersicht)
4. [Initialisierung](#initialisierung)
5. [Datenfluss](#datenfluss)
6. [Benutzerinteraktionen](#benutzerinteraktionen)
7. [Storage Provider](#storage-provider)
8. [Transformation Services](#transformation-services)
9. [State Management](#state-management)
10. [Best Practices](#best-practices)

## Architektur

### Hauptkomponenten

```
library/
├── library.tsx              # Hauptcontainer-Komponente
├── library-header.tsx       # Navigation und Aktionen
├── library-switcher.tsx     # Bibliothekswechsel
├── file-tree.tsx           # Ordnerstruktur (links)
├── file-list.tsx           # Dateiliste (mitte)
├── file-preview.tsx        # Dateivorschau (rechts)
└── [spezifische Viewer]    # Audio, Video, Markdown, etc.
```

### Layout-Struktur

```
┌─────────────────────────────────────────────────────┐
│                  Library Header                      │
│  (Breadcrumb Navigation, Upload Button)             │
├─────────────┬───────────────────┬──────────────────┤
│             │                   │                   │
│  File Tree  │    File List     │   File Preview   │
│             │                   │                   │
│  - Folders  │  - Files         │  - Content       │
│  - Nested   │  - Sortable      │  - Transform     │
│             │  - Searchable    │  - Edit          │
│             │                   │                   │
└─────────────┴───────────────────┴──────────────────┘
```

## Tech Stack

### Core Technologies
- **React 18+** - UI Framework mit Hooks und Concurrent Features
- **TypeScript** - Type Safety und bessere Developer Experience
- **Next.js 14+** - App Router, Server Components
- **Jotai** - Atomic State Management für globalen Zustand

### UI Libraries
- **Shadcn/ui** - Komponenten-Bibliothek
- **Radix UI** - Headless UI Components
- **Tailwind CSS** - Utility-first CSS Framework
- **Lucide React** - Icon Library

### Utilities
- **react-dropzone** - Drag & Drop File Upload
- **remarkable** - Markdown Rendering
- **highlight.js** - Syntax Highlighting
- **sonner** - Toast Notifications

## Komponenten-Übersicht

### 1. Library (Hauptkomponente)
Die zentrale Komponente, die alle anderen orchestriert:
- Verwaltet den globalen Zustand
- Koordiniert die Kommunikation zwischen Unterkomponenten
- Handled Provider-Initialisierung

### 2. FileTree
- Zeigt die Ordnerstruktur
- Lazy Loading von Unterordnern
- Drag & Drop Support für Dateiverschiebung

### 3. FileList
- Tabellarische Darstellung der Dateien
- Sortierung nach Name, Größe, Datum, Typ
- Gruppierung von zusammengehörigen Dateien (Shadow-Twins)
- Inline-Umbenennung
- Batch-Operationen

### 4. FilePreview
- Dynamisches Laden basierend auf Dateityp
- Unterstützte Formate:
  - **Audio**: MP3, M4A, WAV, OGG
  - **Video**: MP4, AVI, MOV
  - **Text**: Markdown, Plain Text
  - **Bilder**: JPG, PNG, GIF, WebP
  - **Dokumente**: PDF (geplant)

### 5. Transform Components
- **AudioTransform**: Transkription von Audio zu Text
- **VideoTransform**: Video-zu-Text mit optionaler Frame-Extraktion
- **TextTransform**: Markdown-Transformation mit Templates

## Initialisierung

### 1. Provider Setup
```typescript
// Die Library nutzt den StorageContext
const { provider, isLoading, error } = useStorage();

// Provider wird basierend auf Library-Config initialisiert:
// - filesystem: LocalStorageProvider
// - onedrive: OneDriveProvider
```

### 2. State Initialisierung
```typescript
// Globale Atoms (Jotai)
- activeLibraryIdAtom     // Aktuelle Bibliothek
- currentFolderIdAtom     // Aktueller Ordner
- breadcrumbItemsAtom     // Navigation Path
- librariesAtom           // Verfügbare Bibliotheken

// Lokaler State
- folderItems            // Dateien im aktuellen Ordner
- selectedItem           // Ausgewählte Datei
- folderCache           // Performance-Optimierung
```

### 3. Lifecycle
1. Component Mount → Provider Initialisierung
2. Provider Ready → Root Items laden
3. Benutzer navigiert → Items lazy laden
4. Cache für Performance

## Datenfluss

### 1. Datei-Navigation
```
User klickt Ordner
    ↓
FileTree.handleFolderSelect()
    ↓
Library.loadItems(folderId)
    ↓
StorageProvider.listItemsById()
    ↓
Update: folderItems, breadcrumb
    ↓
FileList re-render
```

### 2. Datei-Auswahl
```
User wählt Datei
    ↓
FileList.onSelectAction()
    ↓
useSelectedFile.selectFile()
    ↓
FilePreview lädt Content
    ↓
Provider.getBinary() oder getText()
    ↓
Spezifischer Viewer rendert
```

### 3. Datei-Upload
```
User: Upload Button
    ↓
UploadDialog öffnet
    ↓
Drag & Drop oder File Select
    ↓
Provider.uploadFile()
    ↓
Progress Updates
    ↓
refreshItems() → FileList Update
```

## Benutzerinteraktionen

### Basis-Operationen
1. **Navigation**
   - Klick auf Ordner → Inhalt anzeigen
   - Breadcrumb → Schnelle Navigation
   - Collapse/Expand im Tree

2. **Datei-Management**
   - Drag & Drop zum Verschieben
   - Doppelklick zum Umbenennen
   - Delete mit Bestätigung
   - Multi-File Upload

3. **Vorschau & Bearbeitung**
   - Automatische Vorschau nach Dateityp
   - Markdown: Preview/Edit Toggle
   - Media: Inline Player mit Controls

### Erweiterte Features

1. **Shadow-Twin System**
   - Automatische Gruppierung zusammengehöriger Dateien
   - Konvention: `basename.language.extension`
   - Beispiel: `meeting.de.md` (Transkript von `meeting.m4a`)

2. **Transformationen**
   - Audio → Text (Transkription)
   - Video → Text + Frames
   - Text → Strukturierter Text (Templates)

3. **Smart Features**
   - Automatische Spracherkennung
   - Template-basierte Transformation
   - Metadaten-Extraktion

## Storage Provider

### Interface
```typescript
interface StorageProvider {
  id: string;
  name: string;
  listItemsById(id: string): Promise<StorageItem[]>;
  getBinary(id: string): Promise<{ blob: Blob }>;
  uploadFile(parentId: string, file: File): Promise<StorageItem>;
  deleteItem(id: string): Promise<void>;
  moveItem(itemId: string, targetId: string): Promise<void>;
  renameItem(id: string, newName: string): Promise<void>;
}
```

### Implementierungen
1. **LocalStorageProvider**: Lokales Dateisystem
2. **OneDriveProvider**: Microsoft OneDrive Integration

## Transformation Services

### Audio Transformation
```typescript
// Workflow
1. Audio laden → 2. An Secretary API senden
3. Transkription erhalten → 4. Als Shadow-Twin speichern

// Optionen
- Zielsprache
- Dateiname (automatisch oder manuell)
- Shadow-Twin Erstellung
```

### Video Transformation
```typescript
// Features
- Audio-Extraktion und Transkription
- Frame-Extraktion in Intervallen
- Kombinierte Markdown-Ausgabe

// Use Cases
- Meeting-Aufzeichnungen
- Tutorial-Videos
- Präsentationen
```

## State Management

### Jotai Atoms (Global)
```typescript
// Library State
libraryAtom          // Gesamter Library-Zustand
activeLibraryIdAtom  // Aktuelle Bibliothek
librariesAtom        // Liste aller Bibliotheken

// Navigation State
currentFolderIdAtom  // Aktueller Ordner
breadcrumbItemsAtom  // Pfad-Navigation

// UI State
createLibraryAtom    // Dialog-Zustand
```

### React Hooks (Lokal)
```typescript
useSelectedFile()    // Dateiauswahl-Management
useStorage()         // Storage Provider Context
useStorageProvider() // Provider Helper
```

### Performance-Optimierungen
1. **Memoization**: React.memo für alle Listen-Komponenten
2. **Virtualisierung**: Geplant für große Dateilisten
3. **Lazy Loading**: Ordnerinhalte werden bei Bedarf geladen
4. **Caching**: Ordner-Inhalte werden gecacht

## Best Practices

### 1. Error Handling
```typescript
// Immer spezifische Fehlerbehandlung
try {
  await provider.uploadFile(folderId, file);
} catch (error) {
  if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
    // Auth-spezifische Behandlung
  } else {
    // Generische Fehlerbehandlung
  }
}
```

### 2. Performance
- Nutze `React.memo` für Listen-Items
- Implementiere Debouncing für Suche
- Cache API-Responses wo möglich
- Lazy Load große Inhalte

### 3. UX Guidelines
- Zeige immer Loading-States
- Gib klares Feedback (Toasts)
- Ermögliche Abbruch langer Operationen
- Behalte Auswahl bei Refresh

### 4. Accessibility
- Keyboard Navigation in allen Listen
- ARIA Labels für Icons
- Focus Management
- Screen Reader Support

## Erweiterungsmöglichkeiten

1. **Neue Dateitypen**
   - Implementiere neuen Viewer in `file-preview.tsx`
   - Registriere Typ in `getFileType()`

2. **Neue Provider**
   - Implementiere `StorageProvider` Interface
   - Registriere in `StorageFactory`

3. **Neue Transformationen**
   - Erstelle Transform-Komponente
   - Integriere in entsprechenden Viewer

## Debugging

### Nützliche Logs
```typescript
// Aktiviere Debug-Modus
localStorage.setItem('debug', 'library:*');

// Wichtige Log-Punkte
- Provider-Initialisierung
- Datei-Operationen
- Transform-Prozesse
- Cache-Hits/Misses
```

### Häufige Probleme
1. **"Provider nicht verfügbar"**
   - Prüfe Library-Konfiguration
   - Verifiziere Auth-Status

2. **Dateien werden nicht angezeigt**
   - Cache leeren
   - Provider-Verbindung prüfen

3. **Transform fehlgeschlagen**
   - API-Schlüssel prüfen
   - Dateiformat verifizieren
