# Knowledge Scout - Kernkomponenten

## Bibliotheks-Komponenten

### Library
**Hauptzweck:** Hauptkomponente für die Dateibibliothek-Ansicht

**Props:**
- `libraries`: Array von ClientLibrary-Objekten
- `defaultLayout`: Array für Standard-Panel-Größen [20, 32, 48]
- `defaultCollapsed`: Boolean für initialen Zustand
- `navCollapsedSize`: Nummer für minimierte Nav-Größe

**Zentrale Funktionen:**
- State Management für aktive Bibliothek und Dateien
- Verzeichnisnavigation und Breadcrumb-Handling
- Datei-Preview Integration
- Responsives Layout mit veränderbaren Panels

**Besonderheiten:**
- Verwendet ResizablePanelGroup für flexible Layouts
- Cache-System für Ordnerstruktur
- Event-basierte Kommunikation mit TopNav

### FileTree
**Hauptzweck:** Zeigt die Ordnerstruktur der Bibliothek an

**Props:**
- `provider`: StorageProvider Interface
- `onSelect`: Callback für Ordnerauswahl
- `currentFolderId`: Aktuelle Ordner-ID
- `libraryName`: Name der aktiven Bibliothek

**Besonderheiten:**
- Hierarchische Darstellung der Ordnerstruktur
- Interaktive Navigation

### FileList
**Hauptzweck:** Listenansicht der Dateien im aktuellen Ordner

**Props:**
- `items`: Array von StorageItems
- `selectedItem`: Aktuell ausgewähltes Item
- `onSelect`: Callback für Dateiauswahl
- `currentFolderId`: Aktuelle Ordner-ID

**Besonderheiten:**
- Sortier- und Filterfunktionen
- Verschiedene Anzeigemodi (Liste/Grid)

### FilePreview
**Hauptzweck:** Vorschau für ausgewählte Dateien

**Props:**
- `item`: StorageItem für Preview
- `provider`: StorageProvider für Datenzugriff
- `className`: CSS Klassen

**Besonderheiten:**
- Unterstützung verschiedener Dateitypen
- Markdown-Rendering mit react-markdown
- Code-Highlighting

### LibrarySwitcher
**Hauptzweck:** Auswahl zwischen verschiedenen Bibliotheken

**Props:**
- `libraries`: Verfügbare Bibliotheken
- `activeLibraryId`: Aktuelle Bibliothek
- `onLibraryChange`: Callback für Bibliothekswechsel

**Besonderheiten:**
- Dropdownmenü mit Bibliotheksauswahl
- Zeigt Bibliotheksstatus an

## UI-Komponenten

### ThemeProvider
**Hauptzweck:** Theme-Management

**Besonderheiten:**
- Dark/Light Mode Unterstützung
- System-Theme-Detection
- Theme-Persistenz

### TopNav
**Hauptzweck:** Hauptnavigation

**Besonderheiten:**
- Responsive Design
- Integration mit LibrarySwitcher
- Authentifizierungsstatus

## Datenfluss zwischen Komponenten

1. **Hierarchie:**
   ```
   Library
   ├─ FileTree (Navigation)
   ├─ FileList (Inhaltsanzeige)
   └─ FilePreview (Detailansicht)
   ```

2. **State-Management:**
   - Zentraler State in Library-Komponente
   - Props-Drilling für untergeordnete Komponenten
   - Event-System für komponenten-übergreifende Updates

3. **Daten-Handling:**
   - StorageProvider-Interface für Datenzugriff
   - Cache-System für Ordnerstruktur
   - Optimierte Ladestrategie für große Datenmengen