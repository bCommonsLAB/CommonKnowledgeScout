# Knowledge Scout - Hauptkonzept und Architektur

## Überblick

Knowledge Scout (auch bekannt als Common Knowledge Scout) ist ein modernes Dokumentenmanagementsystem, das darauf ausgelegt ist, Dokumente über verschiedene Speicheranbieter hinweg einheitlich zu verwalten, zu organisieren und zu durchsuchen. Die Anwendung basiert auf einer modernen Webarchitektur mit Next.js 14, TypeScript und einer umfangreichen UI-Komponenten-Bibliothek.

## Zielsetzung

Die Hauptziele des Knowledge Scout sind:

1. **Einheitliche Dokumentenverwaltung**: Bereitstellung einer konsistenten Benutzeroberfläche für den Zugriff auf Dokumente aus verschiedenen Quellen (lokale Dateisysteme, Cloud-Dienste)
2. **Erweiterte Metadatenverarbeitung**: Anreicherung von Dokumenten mit Metadaten zur besseren Organisation und Suche
3. **Transkription und Transformation**: Automatische Verarbeitung von Medieninhalten (Audio, Video) zu durchsuchbarem Text
4. **Flexible Speicherprovider**: Abstraktion verschiedener Speichersysteme hinter einer einheitlichen API
5. **Berechtigungsverwaltung**: Feingranulare Steuerung des Zugriffs auf Dokumente

## Architekturkonzept

### Frontend-Architektur

Die Anwendung folgt dem Next.js App Router-Konzept mit React Server Components (RSC) und Client Components. Sie ist modular aufgebaut und basiert auf folgenden Kernkonzepten:

1. **Komponenten-basierter Aufbau**: 
   - UI-Komponenten (shadcn/ui und Radix UI)
   - Funktionale Komponenten (Library, FileTree, FileList, FilePreview)
   - Kontextspezifische Komponenten (Transformation, Upload, Preview)

2. **State Management**:
   - Jotai für globalen State (Bibliotheken, aktive Bibliothek, aktueller Ordner)
   - React Hooks für lokale Zustandsverwaltung
   - Kontextbasierte Provider (StorageContext) für spezifische Funktionalitäten

3. **Routing**:
   - Seitenbasierte Struktur mit Next.js App Router
   - API-Routes für Backend-Funktionalitäten

### Backend-Integration

Die Anwendung implementiert verschiedene Backend-Integrationen:

1. **Storage Provider System**:
   - Abstrakte StorageProvider-Schnittstelle
   - Implementierungen für verschiedene Speicheranbieter (lokal, OneDrive, Google Drive)
   - Einheitliche API für Dateioperationen

2. **Transkriptions- und Transformationsservices**:
   - Integration mit externen Diensten für Medienverarbeitung
   - ShadowTwin-Konzept für die Zuordnung von Transkriptionen zu Originaldateien

3. **Authentifizierung**:
   - Clerk für Benutzerauthentifizierung und -management
   - Middleware für geschützte Routen

## Hauptkomponenten und ihr Zusammenspiel

### 1. Library-System

Das Herzstück der Anwendung ist das Library-System, das folgende Komponenten umfasst:

- **Library**: Hauptkomponente zur Anzeige und Interaktion mit Dokumenten
- **LibrarySwitcher**: Ermöglicht den Wechsel zwischen verschiedenen Bibliotheken
- **FileTree**: Hierarchische Baumansicht der Ordnerstruktur
- **FileList**: Listenansicht der Dateien im aktuellen Ordner
- **FilePreview**: Vorschaukomponente für verschiedene Dateitypen

Diese Komponenten arbeiten zusammen, um eine nahtlose Navigation und Interaktion mit Dokumenten zu ermöglichen. Die Bibliothek ist das Container-Element, das die Anzeige und Navigation in Dateien und Ordnern koordiniert.

### 2. Storage Provider System

Das Storage Provider System ist eine abstrakte Schicht, die einheitlichen Zugriff auf verschiedene Speichersysteme ermöglicht:

- **StorageProvider Interface**: Definiert die grundlegenden Operationen (Listen, Lesen, Schreiben, Löschen)
- **Provider-Implementierungen**: Spezifische Implementierungen für verschiedene Speicheranbieter
- **StorageContext**: React-Kontext, der den aktuellen Provider und Hilfsfunktionen bereitstellt

Dieses System ermöglicht es der Anwendung, ohne Änderung der Benutzeroberfläche mit verschiedenen Speichersystemen zu arbeiten.

### 3. Transformation und Transkription

Für die Verarbeitung von Medieninhalten bietet die Anwendung:

- **ShadowTwin-Konzept**: Speicherung von Transkriptionen als "Zwillingsdateien" neben den Originalen
- **Transformation Services**: Verarbeitung von Audio und Video zu Text
- **Markdown-Unterstützung**: Anzeige und Bearbeitung von Transkriptionsinhalten

Diese Funktionen ermöglichen die Extraktion von Informationen aus Mediendateien und machen sie durchsuchbar und besser organisierbar.

### 4. UI-Komponenten

Die Benutzeroberfläche basiert auf:

- **shadcn/ui und Radix UI**: Zugängliche, wiederverwendbare UI-Komponenten
- **Tailwind CSS**: Stilsystem für konsistentes Design
- **Responsive Layout**: Anpassung an verschiedene Bildschirmgrößen mit ResizablePanels

## Datenfluss und Interaktionen

1. **Bibliotheksauswahl**:
   - Benutzer wählt eine Bibliothek aus dem LibrarySwitcher
   - Die Auswahl wird im globalen Zustand (Jotai) gespeichert
   - Der entsprechende StorageProvider wird aktiviert

2. **Navigation und Anzeige**:
   - Benutzer navigiert durch den FileTree oder die Breadcrumb-Navigation
   - Bei Ordnerwechsel aktualisiert die Library den Pfad-Cache und lädt Inhalte
   - Bei Dateiauswahl wird die Datei im FilePreview angezeigt

3. **Dateioperationen**:
   - Upload, Löschen und Verschieben werden über den StorageProvider abgewickelt
   - Änderungen werden im UI reflektiert und der Cache aktualisiert

4. **Transformation**:
   - Medieninhalte können zur Transkription geschickt werden
   - Ergebnisse werden als ShadowTwin gespeichert und können angezeigt/bearbeitet werden

## Erweiterbarkeit

Die Anwendung ist modular aufgebaut und kann leicht erweitert werden:

1. **Neue Speicheranbieter**: Durch Implementierung des StorageProvider Interface
2. **Zusätzliche Transformationen**: Durch Hinzufügen neuer Transformationsservices
3. **UI-Anpassungen**: Durch Erweiterung der bestehenden Komponenten

## Zusammenfassung

Knowledge Scout ist eine hochflexible Dokumentenmanagement-Plattform, die durch ihre abstrakte Speicherprovider-Architektur, moderne UI-Komponenten und fortschrittliche Medienverarbeitungsfunktionen eine leistungsstarke Lösung für die einheitliche Verwaltung von Dokumenten aus verschiedenen Quellen bietet. Das System zeichnet sich durch seinen modularen Aufbau, seinen Fokus auf Benutzerfreundlichkeit und die nahtlose Integration verschiedener Speichersysteme aus. 