# FilePreview Komponente

## 1. User Stories
- Als User möchte ich eine Vorschau der ausgewählten Datei sehen (Audio, Video, Text, Markdown, Bild, Dokument).
- Als User möchte ich direkt aus der Vorschau heraus Transformationen oder Transkriptionen starten können.

## 2. Initialisierung
- Wird geladen, sobald eine Datei in der FileList ausgewählt wird.
- Erkennt den Dateityp und lädt den passenden Viewer.

## 3. Features
- Dynamische Vorschau je nach Dateityp (Audio, Video, Markdown, Text, Bild, PDF, ...)
- Tabs für Vorschau/Bearbeitung (z.B. Markdown)
- Transformation/Transkription direkt aus der Vorschau
- Fehler- und Ladezustände

## 4. Abhängigkeiten
- **Atoms:**
  - `selectedItemAtom`
  - `activeLibraryIdAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - AudioPlayer, VideoPlayer, MarkdownPreview, TextEditor, ImagePreview, DocumentPreview
  - Transform-Komponenten

## 5. API Calls
- `provider.getBinary(itemId)` – Laden des Datei-Inhalts
- `provider.getStreamingUrl(itemId)` – (Audio/Video)
- Indirekt: Transformation/Transkription (API-Call über TransformService)
- Fehlerfälle: Datei nicht gefunden, Netzwerkfehler, nicht unterstützter Typ

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Viewer-Delegation ist komplex und könnte modularer werden
- Caching von Datei-Inhalten ist noch rudimentär
- Fehlerhandling für exotische Dateitypen verbessern

## 7. ToDos
- Viewer-Logik in eigene Komponenten/Hooks auslagern
- Caching-Strategie für Vorschauinhalte verbessern
- Testabdeckung für alle Dateitypen und Fehlerfälle erhöhen 