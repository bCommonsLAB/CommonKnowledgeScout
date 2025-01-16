# Kernkomponenten

## Bibliotheks-Komponenten

### Library
**Hauptzweck**: Hauptkomponente für die Dateibibliothek-Ansicht mit dreispaltigem Layout.

**Props**:
- `libraries`: Array von `ClientLibrary`-Objekten
- `defaultLayout`: Array für die Standard-Spaltenbreiten [20, 32, 48]
- `defaultCollapsed`: Boolean für initialen Zustand
- `navCollapsedSize`: Größe der kollabierten Navigation

**Zentrale Funktionen**:
- Verwaltung des aktiven Providers und der Bibliotheksauswahl
- Ordner-Navigation und Breadcrumb-Pfad
- Datei-Vorschau und -Auswahl
- Responsive Layout mit anpassbaren Spaltenbreiten

**Besonderheiten**:
- Integrierte Suche
- Transcription-Twin-Unterstützung
- Persistentes Layout über Cookies
- Event-basierte Kommunikation mit TopNav

### FileTree
**Hauptzweck**: Hierarchische Darstellung der Ordnerstruktur.

**Props**:
- `provider`: StorageProvider für Dateizugriff
- `onSelect`: Callback für Ordnerauswahl
- `currentFolderId`: Aktiver Ordner
- `libraryName`: Name der Bibliothek

**Zentrale Funktionen**:
- Lazy-Loading von Unterordnern
- Filterung versteckter Dateien
- Rekursive Ordnerstruktur-Darstellung

**Besonderheiten**:
- Optimierte Performance durch bedarfsgesteuertes Laden
- Visuelle Hervorhebung des aktiven Ordners

### FileList
**Hauptzweck**: Listenansicht von Dateien und Ordnern.

**Props**:
- `items`: Array von StorageItems
- `selectedItem`: Aktuell ausgewähltes Item
- `onSelectAction`: Callback für Dateiauswahl
- `searchTerm`: Suchfilter
- `currentFolderId`: Aktueller Ordner

**Besonderheiten**:
- Dateitypspezifische Icons
- Integrierte Suchfunktion
- Unterstützung für Transcription-Twins

### LibrarySwitcher
**Hauptzweck**: Dropdown zur Auswahl der aktiven Bibliothek.

**Props**:
- `isCollapsed`: Kollabierter Zustand
- `libraries`: Verfügbare Bibliotheken
- `activeLibraryId`: Aktive Bibliothek
- `onLibraryChange`: Callback für Bibliothekswechsel

**Besonderheiten**:
- Responsive Design mit Kollaps-Unterstützung
- Icon-Integration für Bibliotheken

## UI-Komponenten

### Tree
**Hauptzweck**: Wiederverwendbare Baumstruktur-Komponente.

**Komponenten**:
- `Tree.Root`: Container für Baumstruktur
- `Tree.Item`: Einzelnes Baumelement

**Props (TreeItem)**:
- `label`: Anzeigetext
- `icon`: Optionales Icon
- `isExpanded`: Ausgeklappter Zustand
- `isSelected`: Auswahlzustand
- `level`: Verschachtelungstiefe

**Besonderheiten**:
- Rekursive Struktur
- Anpassbare Icons
- Automatische Einrückung

### Card
**Hauptzweck**: Container für strukturierte Inhalte.

**Komponenten**:
- `Card`: Hauptcontainer
- `CardHeader`: Kopfbereich
- `CardTitle`: Überschrift
- `CardDescription`: Beschreibungstext

**Besonderheiten**:
- Konsistentes Styling
- Flexible Komposition
- Schatten und Rundungen

### TopNav
**Hauptzweck**: Hauptnavigationsleiste der Anwendung.

**Funktionen**:
- Navigation zwischen Hauptbereichen
- Bibliotheksauswahl-Integration
- Theme-Umschaltung
- Authentifizierungs-UI

**Besonderheiten**:
- Responsive Design
- Clerk-Integration für Auth
- Dynamische Bibliotheksauswahl 