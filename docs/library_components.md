# Library Components

Die Library-Komponenten bilden das Herzstück der Dokumentenverwaltung und -anzeige im Knowledge Scout. Sie ermöglichen die effiziente Verwaltung, Navigation und Anzeige verschiedener Dateitypen mit besonderem Fokus auf Markdown-Dokumente und Medieninhalte.

## Library

Die `Library`-Komponente ist der Hauptcontainer für die Dokumentenverwaltung und implementiert ein dreispaltiges Layout.

### Features

- **Flexibles Layout**: 
  - Dreispaltiges Split-View mit anpassbarer Größe
  - Dateibaum auf der linken Seite (15-20% Breite)
  - Dateiliste in der Mitte (30% Breite)
  - Dateivorschau auf der rechten Seite (48% Breite)
  - Kollabierbare Panels mit Drag-Handles

- **Integrierte Navigation**:
  - Breadcrumb-Navigation mit Pfadhistorie
  - Ordner-Hierarchie mit Lazy Loading
  - Intelligente Datei-Auswahl und Vorschau

- **Performance-Optimierungen**:
  - Lazy Loading von Ordnerinhalten
  - Caching von Ordnerinhalten und Pfaden
  - Memoization von React-Komponenten
  - Optimierte Re-Renders durch React.memo
  - Performance-Tracking und Monitoring

- **State Management**:
  - Zentrales State Management für Bibliotheksauswahl
  - Effizientes Caching von Ordnerinhalten
  - Optimierte Pfadauflösung
  - Intelligente Fehlerbehandlung

### Verwendung

```tsx
<Library 
  libraries={clientLibraries}
  defaultLayout={[20, 32, 48]}
  defaultCollapsed={false}
  navCollapsedSize={50}
/>
```

### Props

- `libraries`: Array von `ClientLibrary`-Objekten mit Bibliothekskonfigurationen
- `defaultLayout`: Prozentuale Verteilung der Panel-Breiten [links, mitte, rechts]
- `defaultCollapsed`: Ob der linke Panel initial kollabiert sein soll
- `navCollapsedSize`: Breite des kollabierten linken Panels in Pixeln

## FileTree

Die `FileTree`-Komponente implementiert eine hierarchische Baumansicht für Ordner.

### Features

- **Hierarchische Darstellung**:
  - Verschachtelte Ordnerstruktur
  - Expand/Collapse-Funktionalität mit Chevron-Icons
  - Visuelle Hierarchie durch Einrückung
  - Lazy Loading von Unterordnern

- **Performance**:
  - Lazy Loading von Ordnerinhalten
  - Caching von geladenen Ordnern
  - Optimierte Re-Renders
  - Filterung versteckter Ordner

- **Navigation**:
  - Keyboard-Navigation
  - Visuelles Feedback für aktiven Ordner
  - Automatisches Expandieren des Pfads

### Verwendung

```tsx
<FileTree 
  provider={storageProvider}
  onSelect={handleFolderSelect}
  currentFolderId={selected.breadcrumb.currentId}
  libraryName={activeLibrary?.label}
/>
```

## FileList

Die `FileList`-Komponente zeigt Dateien in einer tabellarischen Liste an.

### Features

- **Listenansicht**:
  - Spalten für Typ, Name, Größe und Transkript-Status
  - Sortierbare Spalten
  - Datei-Metadaten und Icons
  - Responsive Darstellung

- **Interaktive Funktionen**:
  - Datei-Auswahl mit visueller Hervorhebung
  - Transkript-Management (Erstellen/Anzeigen)
  - Suchfilterung
  - Keyboard-Navigation

- **Performance**:
  - Virtualisierte Liste für große Dateimengen
  - Memoization von Listeneinträgen
  - Optimierte Re-Renders
  - Effiziente Filterung

### Verwendung

```tsx
<FileList 
  items={finalItems}
  selectedItem={selected.item}
  onSelectAction={handleFileSelect}
  searchTerm={searchQuery}
  currentFolderId={selected.breadcrumb.currentId}
/>
```

## FilePreview

Die `FilePreview`-Komponente ist der zentrale Baustein für die Dokumentenanzeige mit intelligenter Dateityperkennung.

### Features

- **Intelligente Dateityperkennung**: 
  Automatische Erkennung und spezifische Behandlung verschiedener Dateitypen:
  - Markdown (`.md`, `.mdx`)
  - Audio (`.mp3`, `.m4a`, `.wav`, `.ogg`)
  - Video (`.mp4`, `.avi`, `.mov`)
  - Bilder (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`)
  - PDF (`.pdf`)
  - Text (`.txt`, `.doc`, `.docx`)

- **Markdown-Spezifische Features**: 
  - Tabs-Interface mit "Vorschau" und "Metadaten"
  - YAML-Frontmatter Parsing und Anzeige
  - Syntax Highlighting für Code-Blöcke
  - Obsidian-kompatible Links

- **Medien-Features**:
  - Integrierter Audio-Player
  - Video-Player mit Kontrollen
  - Bild-Vorschau mit Zoom
  - PDF-Viewer

- **Transkript-Integration**: 
  - Automatische Erkennung von Transkripten
  - Split-View für Audio/Video mit Transkript
  - Synchronisation von Audio und Text

### Verwendung

```tsx
<FilePreview 
  item={selected.item} 
  provider={providerInstance}
  className="h-full"
/>
```

## MarkdownPreview

Die `MarkdownPreview`-Komponente rendert Markdown-Inhalte mit erweiterten Funktionen.

### Features

- **Syntax Highlighting**: 
  - Automatische Spracherkennung
  - Highlighting mit highlight.js
  - Dunkles Theme (vs2015)
  - Kopieren-Button für Code-Blöcke

- **Obsidian-Kompatibilität**:
  - Wiki-Links (`[[Link]]`)
  - Eingebettete Medien
  - Callouts und Admonitions
  - Tags und Metadaten

- **Erweiterte Formatierung**:
  - Responsive Tabellen
  - Blockquotes mit Icons
  - Task Lists
  - Mathematische Formeln (KaTeX)
  - Mermaid Diagramme

### Verwendung

```tsx
<MarkdownPreview 
  content={markdownString}
  currentFolderId={item.parentId}
  provider={provider}
  currentItem={item}
  className="mt-4"
/>
```

## MarkdownMetadata

Die `MarkdownMetadata`-Komponente extrahiert und visualisiert YAML-Frontmatter aus Markdown-Dokumenten.

### Features

- **YAML-Frontmatter Parsing**:
  - Extraktion zwischen `---` Markierungen
  - Validierung des YAML-Formats
  - Fehlerbehandlung
  - Unterstützung für verschachtelte Objekte

- **Datentyp-Unterstützung**:
  - Tags als Pills/Badges
  - Arrays (mit/ohne Klammern)
  - Einfache Werte
  - Datumsformatierung
  - URLs mit Validierung
  - Leere Werte

- **Spezielle Formatierung**:
  - Tags als farbige Pills
  - Arrays als gruppierte Elemente
  - URLs als klickbare Links
  - Leere Werte als "—"
  - Responsive Tabellenansicht

### Beispiel für unterstützte Frontmatter

```yaml
---
tags: [local llm, local llama, python, claude 3 opus]
Personen: All About AI
Datum: 2024-03-13
Ort: 
Video-URL: https://www.youtube.com/watch?v=oP1_tp_TnWA
Video-Thumbnail: https://img.youtube.com/vi/oP1_tp_TnWA/hqdefault.jpg
Video-ID: oP1_tp_TnWA
Uploader: All About AI
Kategorie: ["Science & Technology"]
Type: Video-Zusammenfassung
---
```

### Verwendung

```tsx
<MarkdownMetadata 
  content={markdownString}
  className="p-4"
/>
```

## Performance-Optimierungen

Die Library-Komponenten implementieren verschiedene Performance-Optimierungen:

- **Memoization**: 
  - Alle Komponenten nutzen `React.memo`
  - Optimierte Vergleichsfunktionen
  - Memoization von Berechnungen mit `useMemo`
  - Stabile Callbacks mit `useCallback`

- **Lazy Loading**:
  - Ordnerinhalte werden bei Bedarf geladen
  - Bilder und Medien mit progressivem Loading
  - Code-Splitting für Previews
  - Dynamischer Import von Bibliotheken

- **Caching**:
  - Ordnerinhalte werden gecached
  - Pfadauflösung mit Caching
  - Metadaten-Caching
  - Browser-Cache für Binärdaten

- **State Management**:
  - Optimierte Re-Renders
  - Granulares State-Updates
  - Effiziente Zustandsübergänge
  - Vermeidung von Wasserfall-Effekten

## Styling

Die Library-Komponenten nutzen ein modernes Styling-System:

- **Tailwind CSS**: 
  - Utility-First Styling
  - Dark Mode Support
  - Responsive Design
  - Custom Utilities

- **shadcn/ui**: 
  - Konsistentes Design-System
  - Barrierefreie Komponenten
  - Themeable Components
  - Radix UI Primitives

- **Responsive Design**:
  - Mobile-First Ansatz
  - Breakpoint System
  - Flexible Layouts
  - Touch-optimiert

- **Themes**:
  - Light/Dark Mode
  - Custom Color Schemes
  - CSS Variables
  - Theme Switching 