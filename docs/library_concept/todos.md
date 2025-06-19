# Library Concept ToDos

Diese Liste fasst alle ToDos aus den Library-Concept-Dokumenten zusammen. Die Priorität (1-10) kann dann vom Team festgelegt werden.
1 = Höchste Priorität, 10 = Niedrigste Priorität

## Global State & Infrastructure
| ToDo | Quelle | Prio | Status |
|------|---------|------|--------|
| Konsolidierung und klare Benennung aller Atoms | Global State | 1 | 🔲 |
| Einheitliche Persistenzstrategie | Global State | 1 | 🔲 |
| Initialisierungssequenz implementieren | Initialization Sequence | 1 | 🔲 |
| Dokumentation aller Atoms und Contexts mit Typen | Global State | 2 | 🔲 |
| Zentrale Logging-API mit Komponententags einführen | Error Handling | 2 | 🔲 |
| Logging-API und globalen Log-Atom implementieren | Error Handling | 2 | 🔲 |
| Fehlerhandling vereinheitlichen (Error Boundaries, typisierte Fehler) | Error Handling | 2 | 🔲 |
| DebugPanel um LogView und Checkboxen erweitern | Error Handling | 3 | 🔲 |
| Bestehende Komponenten auf neue Logging-API umstellen | Error Handling | 4 | 🔲 |
| Teststrategie und Coverage-Reports für alle Kernkomponenten | Error Handling | 5 | 🔲 |
| Übersichtliches Diagramm aller State-Flows erstellen | Global State | 5 | 🔲 |

## Navigation & UI
| ToDo | Quelle | Prio | Status |
|------|---------|------|--------|
| Breadcrumb-Logik zentralisieren | Header | 1 | 🔲 |
| Breadcrumb-Logik vollständig in die Komponente verlagern | Breadcrumb | 1 | 🔲 |
| Upload-Dialog als eigene Komponente auslagern | Header | 3 | 🔲 |
| Settings-Button als eigenständige Komponente | Header | 4 | 🔲 |
| Besseres Handling für sehr lange Pfade (z.B. Ellipsis) | Breadcrumb | 4 | 🔲 |
| Testabdeckung für Navigation und Scrollverhalten | Breadcrumb | 5 | 🔲 |

## FileTree & FileList
| ToDo | Quelle | Prio | Status |
|------|---------|------|--------|
| Caching-Strategie für geladene Ordner verbessern | FileTree | 1 | 🔲 |
| Gruppierungs- und Sortierlogik in eigene Utilities auslagern | FileList | 2 | 🔲 |
| Drag & Drop in eigene Hook/Komponente auslagern | FileTree | 3 | 🔲 |
| Fehler-Feedback für Drag & Drop vereinheitlichen | FileTree | 3 | 🔲 |
| Drag & Drop und Rename-Logik modularisieren | FileList | 3 | 🔲 |
| Batch-Operationen als eigene Hooks/Komponenten | FileList | 4 | 🔲 |
| Testabdeckung für Tree-Interaktionen erhöhen | FileTree | 5 | 🔲 |
| Testabdeckung für alle Interaktionen erhöhen | FileList | 5 | 🔲 |

## Upload & Preview
| ToDo | Quelle | Prio | Status |
|------|---------|------|--------|
| Caching-Strategie für Vorschauinhalte verbessern | FilePreview | 1 | 🔲 |
| Viewer-Logik in eigene Komponenten/Hooks auslagern | FilePreview | 2 | 🔲 |
| Fehlerhandling und Retry-Logik verbessern | Upload | 3 | 🔲 |
| UX für Drag & Drop und Multi-Upload weiter optimieren | Upload | 4 | 🔲 |
| Echte Fortschrittsanzeige mit Backend-Events (falls möglich) | Upload | 4 | 🔲 |
| Testabdeckung für Upload-Fehlerfälle erhöhen | Upload | 5 | 🔲 |
| Testabdeckung für alle Dateitypen und Fehlerfälle erhöhen | FilePreview | 5 | 🔲 |

## Transformation & Transcription
| ToDo | Quelle | Prio | Status |
|------|---------|------|--------|
| Transformationsergebnis-Logik in eigene Hooks/Komponenten | Transform | 5 | 🔲 |
| Fehlerhandling und Retry-Logik verbessern (Transcription) | Transcription | 5 | 🔲 |
| Fehlerhandling und Retry-Logik für einzelne Dateien verbessern | BatchTranscription | 5 | 🔲 |
| Echte Fortschrittsanzeige mit Backend-Events (Transcription) | Transcription | 6 | 🔲 |
| Echte Fortschrittsanzeige mit Backend-Events (Batch) | BatchTranscription | 6 | 🔲 |
| UX für Optionen und Ergebnis-Preview optimieren | Transform | 6 | 🔲 |
| Testabdeckung für Transkriptions-Edge-Cases erhöhen | Transcription | 7 | 🔲 |
| Testabdeckung für verschiedene Transformationsarten erhöhen | Transform | 7 | 🔲 |
| Testabdeckung für Batch-Edge-Cases erhöhen | BatchTranscription | 7 | 🔲 |

## Legende Status
🔲 Offen
✅ Erledigt
⏳ In Bearbeitung
❌ Verworfen

## Begründung der Prioritäten

### Prio 1 (Technische Grundlagen)
- State Management (Atoms, Persistenz)
- Caching-Strategien für Kernfunktionen
- Grundlegende Navigation (Breadcrumb)

### Prio 2 (Einfaches Logging & Fehlerbehandlung)
- Basis Logging-Infrastruktur
- Zentrale Fehlerbehandlung
- Grundlegende Komponenten-Modularisierung

### Prio 3 (Initialisierung & Kernfunktionen)
- Optimierung der Ladezyklen
- Verbesserung der Grundfunktionen
- Basis-Fehlerhandling für Benutzerinteraktionen

### Prio 4 (Performance & UX Basics)
- Performance-Optimierungen
- Grundlegende UX-Verbesserungen
- Fortschrittsanzeigen

### Prio 5-7 (Erweiterte Funktionen)
- Transcription & Transformation
- Batch-Prozesse
- Erweiterte Tests
- Komplexe UX-Optimierungen 