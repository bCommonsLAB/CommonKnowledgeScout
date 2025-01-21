# Shadow-Twin Feature

Das Shadow-Twin Feature ist ein integriertes System zur Verwaltung und Verknüpfung von Mediendateien mit ihren Transkriptionen. Es ermöglicht eine nahtlose Verbindung zwischen Audio-/Videodateien und deren textuellen Transkriptionen im Markdown-Format.

## Überblick

Shadow-Twins sind Markdown-Dateien, die als "Schatten" oder Begleiter zu Mediendateien fungieren. Sie enthalten die Transkription des Medieninhalts und werden automatisch mit der Originaldatei verknüpft.

### Hauptfunktionen

- Automatische Erkennung von zusammengehörigen Medien und Transkriptionen
- Unterstützung verschiedener KI-generierter Transkriptionsformate
- Nahtlose Navigation zwischen Original und Transkription
- Visuelle Statusanzeige des Transkriptionsstatus

## Konfiguration

### Aktivierung pro Bibliothek

Das Feature wird in der Bibliothekskonfiguration aktiviert:

```typescript
{
  id: "library-1",
  config: {
    transcription: "shadowTwin"
  }
}
```

## Namenskonventionen

Shadow-Twins folgen einer spezifischen Namenskonvention:

| Original        | Mögliche Twins                                      |
|----------------|---------------------------------------------------|
| video.mp4      | video.md (Standard)                                |
| audio.mp3      | audio_anthropic.md (Anthropic-generiert)          |
| lecture.m4a    | lecture_openai.md (OpenAI-generiert)              |

### Unterstützte Suffixe
- Standard: keine Suffix (z.B. `video.md`)
- Anthropic: `_anthropic` (z.B. `video_anthropic.md`)
- OpenAI: `_openai` (z.B. `video_openai.md`)

## Technische Implementation

### Metadaten-Struktur

Jede Datei erhält zusätzliche Metadaten:

```typescript
interface FileMetadata {
  hasTranscript: boolean;      // Hat die Datei eine Transkription?
  isTwin: boolean;            // Ist die Datei selbst eine Transkription?
  transcriptionTwin?: {
    id: string;               // ID des verknüpften Twins
    name: string;             // Name des Twins
    isTranscription: boolean; // Ist es eine Transkription?
  }
}
```

### Hauptkomponenten

1. **Transcription Twin Hook**
```typescript
useTranscriptionTwins(items: StorageItem[], transcriptionEnabled: boolean)
```
- Verarbeitet Dateien und erkennt zusammengehörige Paare
- Fügt Metadaten für Twins hinzu
- Aktiviert/deaktiviert Feature basierend auf Konfiguration

2. **Dateiauswahl Integration**
```typescript
useSelectedFile()
```
- Verwaltet den Auswahlzustand von Dateien
- Berücksichtigt Twin-Beziehungen
- Ermöglicht Navigation zwischen Original und Transkription

## Beispiele

### Typische Anwendungsfälle

1. **Vorlesungsaufzeichnungen**
```
lectures/
  ├── lecture-1.mp4
  ├── lecture-1.md          # Automatische Transkription
  ├── lecture-2.mp4
  └── lecture-2_anthropic.md # KI-generierte Transkription
```

2. **Podcast-Episoden**
```
podcast/
  ├── episode-1.mp3
  ├── episode-1_openai.md    # OpenAI Transkription
  ├── episode-2.mp3
  └── episode-2_anthropic.md # Anthropic Transkription
```

## Best Practices

1. **Namensgebung**
   - Verwende konsistente Namenskonventionen
   - Behalte die Original-Dateinamen bei
   - Füge nur unterstützte Suffixe hinzu

2. **Organisation**
   - Halte Twins im gleichen Verzeichnis wie die Originale
   - Verwende aussagekräftige Dateinamen
   - Dokumentiere verwendete KI-Modelle durch entsprechende Suffixe

3. **Transkriptionsqualität**
   - Überprüfe generierte Transkriptionen
   - Nutze verschiedene KI-Modelle für bessere Ergebnisse
   - Behalte Originaltranskriptionen als Referenz

## Fehlerbehebung

### Häufige Probleme

1. **Twin wird nicht erkannt**
   - Überprüfe die Namenskonvention
   - Stelle sicher, dass die Dateien im gleichen Verzeichnis sind
   - Verifiziere die Bibliothekskonfiguration

2. **Falsche Zuordnung**
   - Überprüfe die Basis-Dateinamen
   - Stelle sicher, dass keine Konflikte existieren
   - Bereinige inkonsistente Benennungen

## Zukünftige Entwicklung

- Unterstützung weiterer KI-Modelle
- Erweiterte Metadaten für Transkriptionsqualität
- Automatische Qualitätsbewertung
- Versionierung von Transkriptionen 