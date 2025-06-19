# BatchTranscription Komponente

## 1. User Stories
- Als User möchte ich mehrere Dateien gleichzeitig zur Transkription auswählen und verarbeiten können.
- Als User möchte ich den Fortschritt und Status jeder Datei im Batch sehen.
- Als User möchte ich Fehler und Teilerfolge nachvollziehen können.

## 2. Initialisierung
- Wird über die FileList (Batch-Checkboxen und Button) geöffnet.
- Nutzt die ausgewählten Dateien und den aktuellen Provider.

## 3. Features
- Auswahl mehrerer Dateien für die Transkription (Batch)
- Fortschrittsanzeige pro Datei und für das gesamte Batch
- Fehler- und Erfolgsfeedback pro Datei
- Optionen für Sprache, Shadow-Twin, Dateiendung

## 4. Abhängigkeiten
- **Atoms:**
  - `selectedBatchItemsAtom`
  - `transcriptionDialogOpenAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - TranscriptionDialog, BatchTransformService

## 5. API Calls
- `BatchTransformService.transformBatch(items, options, ...)` – Startet die Batch-Transkription (API-Call zum Backend)
- Fehlerfälle: Einzelne Dateien fehlschlagen, Netzwerkfehler, API-Limits

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Fortschrittsanzeige basiert auf lokalem State, nicht auf echten Backend-Events
- Fehlerhandling für Teilerfolge und Abbrüche könnte verbessert werden
- UX: Übersicht und Feedback bei großen Batches optimieren

## 7. ToDos
- Echte Fortschrittsanzeige mit Backend-Events (falls möglich)
- Fehlerhandling und Retry-Logik für einzelne Dateien verbessern
- Testabdeckung für Batch-Edge-Cases erhöhen 