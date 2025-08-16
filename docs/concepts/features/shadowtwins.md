---
title: Shadow-Twin Feature
---

# Shadow-Twin Feature

> Status: ✅ Implementiert

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

```typescript
{
  id: "library-1",
  config: {
    transcription: "shadowTwin"
  }
}
```

## Namenskonventionen

| Original   | Mögliche Twins |
|------------|-----------------|
| video.mp4  | video.md |
| audio.mp3  | audio_anthropic.md |
| lecture.m4a| lecture_openai.md |

### Unterstützte Suffixe
- Standard: keine Suffix (z.B. `video.md`)
- Anthropic: `_anthropic` (z.B. `video_anthropic.md`)
- OpenAI: `_openai` (z.B. `video_openai.md`)

## Technische Implementation (Auszug)

```typescript
interface FileMetadata {
  hasTranscript: boolean;
  isTwin: boolean;
  transcriptionTwin?: { id: string; name: string; isTranscription: boolean };
}
```

### Hooks

```typescript
useTranscriptionTwins(items: StorageItem[], transcriptionEnabled: boolean)
useSelectedFile()
```

## Best Practices
- Konsistente Namenskonventionen
- Twins im gleichen Verzeichnis wie Originale
- KI-Modelle über Suffixe kenntlich machen


