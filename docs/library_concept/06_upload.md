# Upload Komponente

## 1. User Stories
- Als User möchte ich Dateien in die aktuelle Bibliothek/Ordner hochladen können.
- Als User möchte ich den Upload-Fortschritt und eventuelle Fehler sehen.
- Als User möchte ich mehrere Dateien gleichzeitig hochladen können.

## 2. Initialisierung
- Wird über den Upload-Button im Header geöffnet (UploadDialog).
- Nutzt den aktuellen Ordner aus dem globalen State.

## 3. Features
- Drag & Drop und Dateiauswahl für Upload
- Fortschrittsanzeige pro Datei
- Fehleranzeige und Wiederholungsoption
- Unterstützung für Multi-File-Upload

## 4. Abhängigkeiten
- **Atoms:**
  - `currentFolderIdAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - UploadDialog
  - Progress

## 5. API Calls
- `provider.uploadFile(parentId, file)` – Hochladen einer Datei
- Fehlerfälle: Authentifizierungsfehler, Netzwerkfehler, Datei existiert bereits

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Fortschrittsanzeige basiert auf Status im lokalen State, nicht auf echten Netzwerk-Events
- Fehlerhandling für parallele Uploads könnte verbessert werden
- UX: Drag & Drop-Feedback und Fehlermeldungen optimieren

## 7. ToDos
- Echte Fortschrittsanzeige mit Backend-Events (falls möglich)
- Fehlerhandling und Retry-Logik verbessern
- UX für Drag & Drop und Multi-Upload weiter optimieren
- Testabdeckung für Upload-Fehlerfälle erhöhen 