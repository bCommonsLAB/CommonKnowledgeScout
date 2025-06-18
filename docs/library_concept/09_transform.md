# Transform Komponente

## 1. User Stories
- Als User möchte ich eine Datei (Text, Audio, Video) transformieren können (z.B. Markdown-Template, Shadow-Twin, Sprache).
- Als User möchte ich Transformationsergebnisse direkt speichern und weiterverarbeiten können.

## 2. Initialisierung
- Wird aus FilePreview, Transcription oder BatchTranscription aufgerufen.
- Nutzt die aktuelle Datei und Transformationseinstellungen aus dem State.

## 3. Features
- Transformation von Text, Audio oder Video mit verschiedenen Optionen (Sprache, Template, Shadow-Twin)
- Vorschau und Anpassung der Transformationsergebnisse
- Speichern als neue Datei (Shadow-Twin)
- Fehler- und Erfolgsfeedback

## 4. Abhängigkeiten
- **Atoms:**
  - `selectedItemAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - TransformSaveOptions, TransformResultHandler

## 5. API Calls
- `TransformService.transformText(text, item, options, ...)` – Text-Transformation
- `TransformService.transformAudio(file, item, options, ...)` – Audio-Transformation
- `TransformService.transformVideo(file, item, options, ...)` – Video-Transformation
- Fehlerfälle: API-Fehler, Netzwerkfehler, ungültige Optionen

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Transformationsergebnis-Handling ist eng mit UI gekoppelt
- Optionen und Ergebnis-Preview könnten modularer werden
- Fehlerhandling für komplexe Transformationen verbessern

## 7. ToDos
- Transformationsergebnis-Logik in eigene Hooks/Komponenten auslagern
- Testabdeckung für verschiedene Transformationsarten erhöhen
- UX für Optionen und Ergebnis-Preview optimieren 