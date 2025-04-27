# Video-Transformer: Integration und Nutzung

Dieses Dokument beschreibt die Integration und Verwendung des Video-Transformers im Knowledge Scout.

## Übersicht

Der Video-Transformer ist eine Erweiterung des bestehenden Audio-Transformers und ermöglicht es Benutzern, Videodateien zu transformieren. Dabei können folgende Operationen durchgeführt werden:

1. **Audio-Extraktion und Transkription**: Extrahiert die Tonspur aus dem Video und transkribiert sie
2. **Frame-Extraktion**: Extrahiert Einzelbilder aus dem Video in definierten Zeitintervallen

## Systemarchitektur

Die Video-Transformer-Implementierung folgt der gleichen Architektur wie der Audio-Transformer:

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|  Frontend         |------>|  Next.js API      |------>|  Secretary        |
|  (React)          |       |  (Route Handler)  |       |  Service          |
|                   |       |                   |       |                   |
+-------------------+       +-------------------+       +-------------------+
```

### Komponenten

1. **Frontend-Komponenten**:
   - `VideoPlayer.tsx`: Player-Komponente für Videos mit Transform-Button
   - `VideoTransform.tsx`: Formular mit Optionen für die Video-Transformation

2. **API-Route**:
   - `process-video/route.ts`: API-Endpunkt, der Anfragen an den Secretary Service weiterleitet

3. **Service-Klassen**:
   - `TransformService`: Enthält die `transformVideo`-Methode für die Video-Transformation
   - `secretary/client.ts`: Client-Methode `transformVideo` für die Kommunikation mit dem Secretary Service

## Secretary Service API

Der Secretary Service bietet folgenden Endpunkt für die Video-Verarbeitung:

```
POST /video/process
```

### Parameter

| Name          | Typ      | Beschreibung                               | Standardwert |
|---------------|----------|-------------------------------------------|--------------|
| file          | file     | Video-Datei                                | -            |
| extract_audio | boolean  | Audio extrahieren                          | true         |
| extract_frames| boolean  | Frames extrahieren                         | false        |
| frame_interval| integer  | Intervall für Frame-Extraktion (Sekunden)  | 1            |
| useCache      | boolean  | Cache verwenden                            | true         |

### Rückgabeformat

```json
{
  "status": "success",
  "data": {
    "transcription": {
      "text": "Transkribierter Text aus dem Video...",
      "language": "de"
    },
    "frames": [
      {
        "url": "base64-encoded-image-data",
        "timestamp": 1.0
      },
      ...
    ]
  }
}
```

## Workflow

1. **Video-Auswahl**: Benutzer wählt ein Video in der Bibliothek aus
2. **Video-Anzeige**: `VideoPlayer` rendert das Video und zeigt den Transform-Button
3. **Transformation starten**: Benutzer klickt auf "Verarbeiten" und konfiguriert Optionen
4. **Verarbeitung**:
   - Frontend sendet Video und Optionen an die API-Route
   - API-Route leitet die Anfrage an den Secretary Service weiter
   - Secretary Service verarbeitet das Video
5. **Ergebnis speichern**:
   - Transkription wird als Markdown-Datei im gleichen Ordner gespeichert
   - (Optional) Frames könnten als Bilddateien gespeichert werden

## Implementierung

### 1. API-Route

```typescript
// src/app/api/secretary/process-video/route.ts
export async function POST(request: NextRequest) {
  // Authentifizierung und Parameter extrahieren
  // Anfrage an Secretary Service senden
  // Antwort zurückgeben
}
```

### 2. Frontend-Komponenten

```typescript
// src/components/library/video-player.tsx
export const VideoPlayer = memo(function VideoPlayer({ item, onRefreshFolder }: VideoPlayerProps) {
  // Video abspielen und Transform-Button anzeigen
});

// src/components/library/video-transform.tsx
export function VideoTransform({ item, onTransformComplete, onRefreshFolder }: VideoTransformProps) {
  // Formular für Video-Transformations-Optionen
}
```

### 3. Integration in die Dateipräsentation

```typescript
// src/components/library/file-preview.tsx
case 'video':
  return <VideoPlayer item={item} onRefreshFolder={onRefreshFolder} />;
```

## Fehlerbehebung

### Bekannte Probleme und Lösungen

1. **413 Request Entity Too Large**:
   - Ursache: Video-Dateien können sehr groß sein und das Größenlimit des Secretary Service überschreiten
   - Lösung: Implementierung von Chunk-basiertem Upload oder Anpassung der Limits auf Server-Seite

2. **Langsame Verarbeitung**:
   - Ursache: Video-Verarbeitung ist ressourcenintensiv
   - Lösung: Statusanzeige und asynchrone Verarbeitung im Secretary Service

## Zukünftige Erweiterungen

1. **Fortschrittsanzeige**: Implementierung einer Fortschrittsanzeige für lange Video-Transformationen
2. **Frame-Galerie**: Anzeige extrahierter Frames als Galerie
3. **Inhaltserkennung**: KI-basierte Analyse der Video-Inhalte und Metadaten-Extraktion
4. **Highlight-Extraktion**: Automatische Erkennung und Extraktion wichtiger Punkte im Video

## Zusammenfassung

Der Video-Transformer erweitert die Funktionalität des Knowledge Scout und ermöglicht Benutzern, wertvolle Informationen aus Videodateien zu extrahieren. Die Integration folgt dem etablierten Muster des Audio-Transformers und nutzt den Secretary Service für die eigentliche Verarbeitung. 