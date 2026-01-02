# Creation-Wizard auf Shadow‑Twin (v2) ausrichten – Master-Analyse

## Zusammenfassung

Der Creation-Wizard wird umgebaut, um die Shadow‑Twin-Prinzipien konsequent anzuwenden:
- **Source** (kanonisches, editierbares Dokument) wird klar von **Transcript** (Rohkorpus) und **Transformation** (Template-Output) getrennt
- Multi-Source-Rohdaten werden im Shadow‑Twin Dot‑Folder als Bundle organisiert
- Optional können Container-Items (Events/Books) in eigenen Ordnern gespeichert werden, damit Child-Flows (Testimonials) daneben liegen können
- Ein neuer Human-in-the-loop Step (`reviewSources`) macht die Verantwortung für Quellen transparent

## Ist-Zustand

### Aktueller Wizard-Flow

1. **Quellen sammeln** (`collectSource` Step):
   - Multi-Source-System: Quellen werden in `WizardSource[]` gesammelt
   - Nach jedem `addSource()`/`removeSource()` wird **automatisch** `runExtraction()` ausgeführt
   - Das ruft `/api/secretary/process-text` auf und setzt `generatedDraft`

2. **Speichern** (`handleSave`):
   - Eine Markdown-Datei wird erstellt/überschrieben via `provider.uploadFile()`
   - Frontmatter enthält `textSources[]` (Rohquellen als Array)
   - **Keine** Shadow‑Twin-Artefakte werden geschrieben

### Probleme

- **Semantik vermischt**: Source-Datei enthält Rohquellen (`textSources[]`) und Transformation (`generatedDraft.markdown`) gleichzeitig
- **Keine Trennung**: Transcript (authentische Rohbasis) und Transformation (abgeleitet) sind nicht getrennt
- **Verantwortung unklar**: Nutzer sieht nicht explizit, wo seine Verantwortung für Quellen endet und Transformation beginnt
- **Storage-Layout**: Rohquellen liegen im Frontmatter statt als persistierte Dateien im Bundle

## Zielbild

### Semantik: Three Artifacts, One Source

```
Source (kanonisch, menschlich editierbar)
├── event.md (oder event/event.md bei Container)
│   └── Frontmatter: nur Template-Metadaten + System-IDs (keine Rohtexte)
│
└── .event.md/ (Shadow‑Twin Bundle, versteckt)
    ├── sources/
    │   ├── audio-001.webm
    │   ├── url-001.txt (rawWebsiteText)
    │   ├── file-001.txt (extractedText)
    │   └── sources.json (Index)
    ├── event.de.md (Transcript: vollständiger Rohkorpus)
    └── event.<templateName>.de.md (Transformation: Template-Output)
```

### Verantwortungsmodell (Human-in-the-loop)

**Phase A: Quellen (Creator-Verantwortung)**
- Rohquellen werden gesammelt (Text/Audio/URL/Dateien)
- Creator prüft und bestätigt explizit im `reviewSources` Step
- Erst danach startet Transformation

**Phase B: Transformation (System-Vorschlag)**
- LLM/Template erzeugt strukturierte Daten + Markdown
- Creator prüft und korrigiert im `editDraft`/`previewDetail` Step

### Storage-Layout (Standard vs Container)

**Standard (kein Container-Ordner):**
```
currentFolder/
├── event.md
└── .event.md/
    ├── sources/...
    ├── event.de.md
    └── event.<template>.de.md
```

**Container (createInOwnFolder=true):**
```
currentFolder/
└── event/
    ├── event.md
    ├── .event.md/
    │   ├── sources/...
    │   ├── event.de.md
    │   └── event.<template>.de.md
    ├── testimonial-1.md
    ├── .testimonial-1.md/
    ├── testimonial-2.md
    └── .testimonial-2.md/
```

## Architektur-Flow

```mermaid
flowchart TD
    collect[collectSource: Quellen sammeln] --> review[reviewSources: Quellen prüfen]
    review -->|user_confirms| extract[/api/secretary/process-text]
    extract --> draft[generatedDraft: structuredData + markdown]
    draft --> edit[editDraft/previewDetail: Prüfen + Korrigieren]
    edit --> save[save: Source + Bundle schreiben]
    
    save --> source[Source: event.md]
    save --> bundle[Bundle API: /api/library/.../creation/write-bundle]
    bundle --> dotFolder[.event.md/]
    dotFolder --> raw[sources/ + sources.json]
    dotFolder --> transcript[event.de.md]
    dotFolder --> transformation[event.<template>.de.md]
```

## Design-Entscheidungen

### 1. Shadow‑Twin als Bundle-Container

Die bestehende Shadow‑Twin-Zentrallogik kennt **immer genau ein Source-Item**. Multi-Source wird deshalb nicht als mehrere "Sources" modelliert, sondern als **Inhalt/Assets**, die zu dieser einen Source-Datei gehören.

- Dot‑Folder `.{sourceName}` ist der Bundle-Container
- Rohquellen werden als Dateien in `sources/` + `sources.json` Index gespeichert
- Transcript und Transformation sind Shadow‑Twin-Artefakte im Dot‑Folder

### 2. Human-in-the-loop Gate

- Neuer obligatorischer Step `reviewSources`:
  - Zeigt Quellenliste + Transcript-Vorschau
  - Laienhafte Erklärung: "Das ist die Grundlage – dafür bist du verantwortlich"
  - Checkbox + Button "Jetzt auswerten"
- Transformation (`runExtraction`) läuft **nicht mehr automatisch** nach `addSource()`
- Erst nach Bestätigung im `reviewSources` Step wird `/api/secretary/process-text` aufgerufen

### 3. Container-Ordner (optional)

- Template-Flag `creation.output.createInOwnFolder?: boolean`
- Wenn aktiv: Ordner wird aus Output-Dateiname (ohne Extension) erstellt
- Source-Datei heißt wie Ordner: `slug/slug.md`
- Child-Flows (Testimonials) können via `targetFolderId` Query-Param sicher in denselben Ordner speichern

### 4. Server-API für Bundle-Schreiben

**Variant_C (hybrid, pragmatisch):**
- Source bleibt Client-Upload (wie heute)
- Shadow‑Twin Bundle wird via neue Server-API geschrieben
- Pro: minimaler Eingriff, Source-save bleibt stabil
- Contra: Zwei-Schritt Save (teilweise inkonsistent wenn zweiter Schritt fehlschlägt)

**Roadmap zu Variant_B (vollständig server-seitig):**
- Später kann gesamter Save-Flow server-seitig werden (bessere Atomicity, große Uploads)

## Datenmodell

### Source Frontmatter (minimal)

```yaml
---
# Template-Metadaten (aus template.metadata.fields)
title: "Mein Event"
date: "2025-01-15"
...

# System-Metadaten (minimal)
creationTypeId: "event-creation-de"
creationTemplateId: "event-template-id"
creationDetailViewType: "session"
creationTranscriptFileId: "file-id-of-transcript"  # optional
creationTransformationFileId: "file-id-of-transformation"  # optional
---
```

**Nicht mehr im Frontmatter:**
- `textSources[]` (liegt jetzt im Transcript-Artefakt)

### Transcript-Artefakt (event.de.md)

```markdown
---
# Optional: minimale Metadaten für Traceability
sourceFileId: "source-file-id"
createdAt: "2025-01-15T10:00:00Z"
---

[Quelle: Text | 2025-01-15 10:00]
Vollständiger Text-Inhalt...

[Quelle: Webseite | https://example.com]
Vollständiger rawWebsiteText...

[Quelle: Datei | document.pdf]
Vollständiger extractedText...
```

### sources.json (Index)

```json
{
  "sources": [
    {
      "id": "text-001",
      "kind": "text",
      "createdAt": "2025-01-15T10:00:00Z",
      "text": "..."
    },
    {
      "id": "url-001",
      "kind": "url",
      "url": "https://example.com",
      "rawWebsiteText": "...",
      "summary": "..."
    }
  ]
}
```

## Migrationsstrategie

### Für bestehende Creation-Files

**Backward-Compat:**
- Alte Dateien mit `textSources[]` im Frontmatter bleiben lesbar
- Resume-Flow liest weiterhin `textSources[]` (falls neue IDs fehlen)
- Neue Creation-Files schreiben **keine** `textSources[]` mehr

**Optionaler Migration-Job (später):**
- Liest alte Creation-Files
- Extrahiert `textSources[]`
- Erstellt Transcript-Artefakt via `writeArtifact()`
- Entfernt `textSources[]` aus Frontmatter
- Setzt `creationTranscriptFileId`

### Template-Migration

- Bestehende Templates bleiben lauffähig (ohne `reviewSources` Step)
- Schrittweise Migration:
  1. Templates erhalten `reviewSources` Step nach `collectSource`
  2. Container-Templates erhalten `createInOwnFolder: true`

## Tradeoffs

### Pro

- **Saubere Semantik**: Source vs Transcript vs Transformation klar getrennt
- **Nachvollziehbarkeit**: Vollständiger Rohkorpus für Audit/RAG verfügbar
- **Transparenz**: Human-in-the-loop macht Verantwortung klar
- **Skalierbarkeit**: Container-Ordner ermöglicht strukturierte Child-Flows

### Contra

- **Komplexität**: Zwei-Schritt Save (Source + Bundle) kann teilweise inkonsistent sein
- **Migration**: Bestehende Creation-Files müssen optional migriert werden
- **Storage**: Dot‑Folder + sources/ Unterordner erhöht Dateianzahl

### Risiken

- **Provider-Semantik**: `createFolder`/`uploadFile` muss konsistent sein (existierende Ordner, Überschreiben)
- **Große Rohdaten**: Audio/Web-Rohtexte können sehr groß sein → ggf. später Chunking/Segmentierung
- **Template-Änderungen**: Wenn Template-Name sich ändert, muss Transformation-Artefakt umbenannt werden (Shadow‑Twin Writer dedupliziert bereits)

## Akzeptanzkriterien

- ✅ Laie sieht explizit: Quellen → Bestätigung → Transformation
- ✅ Source-Frontmatter enthält keine Vollrohtexte
- ✅ Dot‑Folder enthält transcript + transformation + sources index
- ✅ Container-Templates erzeugen Ordner + Source `slug/slug.md`
- ✅ Testimonials können in denselben Container-Ordner speichern (via `targetFolderId`)
- ✅ Resume funktioniert mit neuen Referenzen (Backward-compat für alte `textSources[]`)

## Code-Referenzen

### Betroffene Dateien

- Wizard: [`src/components/creation-wizard/creation-wizard.tsx`](src/components/creation-wizard/creation-wizard.tsx)
- Corpus: [`src/lib/creation/corpus.ts`](src/lib/creation/corpus.ts)
- Resume Meta: [`src/lib/creation/resume-meta.ts`](src/lib/creation/resume-meta.ts)
- Template Types: [`src/lib/templates/template-types.ts`](src/lib/templates/template-types.ts)
- Shadow‑Twin Writer: [`src/lib/shadow-twin/artifact-writer.ts`](src/lib/shadow-twin/artifact-writer.ts)
- Shadow‑Twin Storage: [`src/lib/storage/shadow-twin.ts`](src/lib/storage/shadow-twin.ts)

### Neue Dateien

- `src/components/creation-wizard/steps/review-sources-step.tsx` (neuer Step)
- `src/lib/creation/creation-transcript.ts` (Serializer/Parser)
- `src/app/api/library/[libraryId]/creation/write-bundle/route.ts` (Bundle-API)




