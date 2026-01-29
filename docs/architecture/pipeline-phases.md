# Pipeline-Phasen Architektur

## Übersicht

Die Dokumentenverarbeitung erfolgt in drei Phasen, die über External Jobs orchestriert werden:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Pipeline-Phasen                                   │
├──────────────────┬──────────────────────┬──────────────────────────────┤
│   Phase 1        │   Phase 2            │   Phase 3                    │
│   EXTRACT        │   TRANSFORM          │   INGEST                     │
├──────────────────┼──────────────────────┼──────────────────────────────┤
│ - OCR/Transkript │ - Template anwenden  │ - RAG-Vektoren erstellen     │
│ - Text extrah.   │ - Metadaten gener.   │ - MongoDB-Index aktualis.    │
│ - Bilder laden   │ - Cover-Bild gener.  │ - Chat-Suche ermöglichen     │
└──────────────────┴──────────────────────┴──────────────────────────────┘
```

## Medientypen

Die Pipeline unterstützt verschiedene Medientypen (definiert in `src/lib/media-types.ts`):

| MediaKind | Phase 1 | Phase 2 | Phase 3 | Beschreibung |
|-----------|---------|---------|---------|--------------|
| `pdf` | OCR via Secretary Service | Template-Transformation | RAG-Ingestion | PDF-Dokumente |
| `audio` | Whisper-Transkription | Template-Transformation | RAG-Ingestion | Audio-Dateien |
| `video` | Video-zu-Audio + Whisper | Template-Transformation | RAG-Ingestion | Video-Dateien |
| `markdown` | **SKIP** (Text existiert) | Template-Transformation | RAG-Ingestion | Markdown/Text |
| `image` | OCR (geplant) | Template-Transformation | RAG-Ingestion | Bild-Dateien |

## Route-Architektur

Zwei API-Routen orchestrieren die Phasen:

### 1. Start-Route (`/api/external/jobs/[jobId]/start`)

**Wann aufgerufen:** Vom Worker, um einen Job zu starten

**Verantwortlich für:**
- Datei aus Storage laden
- Shadow-Twin-Analyse durchführen
- Bei PDF/Audio/Video: Request an Secretary Service senden
- Bei Markdown: **Direkt** Template-Phase ausführen (kein Secretary-Aufruf)

### 2. Callback-Route (`/api/external/jobs/[jobId]`)

**Wann aufgerufen:** Vom Secretary Service nach Abschluss der Extraktion

**Verantwortlich für:**
- Ergebnis von Phase 1 verarbeiten
- Template-Phase ausführen (für PDF/Audio/Video)
- Ingest-Phase ausführen
- Job abschließen

### Unterschiedliche Flows nach Medientyp

```
PDF/Audio/Video:
  start/route.ts ──► Secretary Service ──► route.ts (Callback)
                                              │
                                              ├─► Template-Phase
                                              └─► Ingest-Phase

Markdown:
  start/route.ts ──► Template-Phase (direkt)
                       │
                       └─► Ingest-Phase
```

## Policies

Jede Phase kann mit einer Policy gesteuert werden:

| Policy | Bedeutung |
|--------|-----------|
| `ignore` | Phase überspringen |
| `do` | Ausführen, wenn Gate nicht existiert |
| `force` | Immer ausführen (Gate ignorieren) |

**Gates** prüfen, ob das Ergebnis einer Phase bereits existiert:
- Extract-Gate: Existiert ein Transcript im Shadow-Twin?
- Template-Gate: Existiert eine Transformation im Shadow-Twin?
- Ingest-Gate: Ist das Dokument bereits im RAG-Index?

## Cover-Bild-Generierung

Die Cover-Bild-Generierung ist Teil der Template-Phase (Phase 2):

### Parameter

| Parameter | Quelle | Beschreibung |
|-----------|--------|--------------|
| `generateCoverImage` | Job-Parameter oder Library-Config | Boolean: Bild generieren? |
| `coverImagePrompt` | Job-Parameter oder Library-Config | Custom Prompt (optional) |

### Ablauf

1. Template-Transformation abgeschlossen
2. Prüfung: `generateCoverImage === true` UND kein Cover-Bild existiert
3. Prompt erstellen aus Title + Summary der Transformation
4. API-Aufruf an Secretary Service (`/text2image/generate`)
5. Bild als Base64 empfangen
6. Upload nach Azure Blob Storage
7. URL im Shadow-Twin speichern (`coverImageUrl`)

### Route-Trennung (Race-Condition-Fix)

Cover-Bilder werden nur in EINER Route generiert:

| Job-Typ | Cover-Bild-Route | Grund |
|---------|------------------|-------|
| `text` (Markdown) | `start/route.ts` | Template wird direkt ausgeführt |
| `pdf`, `audio`, `video` | `route.ts` (Callback) | Template wird nach Secretary-Callback ausgeführt |

Dies verhindert Race Conditions bei paralleler Ausführung.

## Job-Struktur

```typescript
interface ExternalJob {
  jobId: string
  job_type: "pdf" | "audio" | "video" | "text"
  status: "queued" | "running" | "completed" | "failed"
  
  parameters: {
    targetLanguage: string
    template?: string
    phases: {
      extract: boolean
      template: boolean
      ingest: boolean
    }
    policies: {
      extract: "ignore" | "do" | "force"
      metadata: "ignore" | "do" | "force"
      ingest: "ignore" | "do" | "force"
    }
    generateCoverImage?: boolean
    coverImagePrompt?: string
  }
  
  steps: [
    { name: "extract_pdf" | "extract_audio" | "extract_video", status: StepStatus }
    { name: "transform_template", status: StepStatus }
    { name: "ingest_rag", status: StepStatus }
  ]
  
  shadowTwinState: {
    baseItem: { id: string, metadata: { name: string } }
    transcriptFiles: Array<{ id: string, metadata: { name: string } }>
    transformed: { id: string, metadata: { name: string } } | null
    shadowTwinFolderId: string | null
  }
}
```

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/lib/media-types.ts` | Zentrale Medientyp-Definitionen |
| `src/lib/pipeline/run-pipeline.ts` | Pipeline-Start-Funktionen |
| `src/lib/external-jobs/phase-template.ts` | Template-Phase + Cover-Bild |
| `src/lib/external-jobs/phase-ingest.ts` | Ingest-Phase |
| `src/app/api/external/jobs/[jobId]/route.ts` | Callback-Route |
| `src/app/api/external/jobs/[jobId]/start/route.ts` | Start-Route |

## UI-Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| `PipelineSheet` | Dialog zur Pipeline-Konfiguration |
| `FlowActions` | Pipeline-Steuerung im Flow-View |
| `FilePreview` | Pipeline-Steuerung in der Datei-Vorschau |
| `PdfBulkImportDialog` | Batch-Verarbeitung von Verzeichnissen |
