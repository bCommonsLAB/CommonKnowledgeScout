# Transcription Komponente

## 1. User Stories
- Als User möchte ich eine einzelne Audio- oder Videodatei transkribieren können.
- Als User möchte ich den Fortschritt und das Ergebnis der Transkription sehen.
- Als User möchte ich Fehler und Statusmeldungen erhalten.

## 2. Initialisierung
- Wird über die FileList oder FilePreview (z.B. Button "Transkribieren") geöffnet.
- Nutzt den aktuellen Provider und die ausgewählte Datei.

## 3. Features
- Starten einer Transkription für eine Datei
- Fortschrittsanzeige und Statusmeldungen
- Anzeige und Auswahl von Transkriptionsoptionen (Sprache, Shadow-Twin, Dateiname)
- Fehler- und Erfolgsfeedback

## 4. Abhängigkeiten
- **Atoms:**
  - `selectedItemAtom`
  - `transcriptionDialogOpenAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - AudioTransform, VideoTransform, TransformResultHandler

## 5. API Calls
- `TransformService.transformAudio(file, item, options, ...)` – Startet die Transkription (API-Call zum Backend)
- `TransformService.transformVideo(file, item, options, ...)` – Für Video
- Fehlerfälle: Datei nicht lesbar, API-Fehler, Netzwerkfehler, Limit erreicht

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Fortschrittsanzeige basiert auf lokalen State, nicht auf echten Backend-Events
- Fehlerhandling für API-Fehler und Limits könnte verbessert werden
- UX: Dialog- und Statusfeedback optimieren

## 7. ToDos
- Echte Fortschrittsanzeige mit Backend-Events (falls möglich)
- Fehlerhandling und Retry-Logik verbessern
- Testabdeckung für Transkriptions-Edge-Cases erhöhen 