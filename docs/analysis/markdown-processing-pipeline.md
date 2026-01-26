# Analyse: Markdown-Verarbeitung (Preview/Transformation/Ingestion)

## Ausgangsfrage

Markdown ist bereits Text. Daher ist eine **Transkription/Extraction** (wie bei Audio/PDF) fachlich meist unnötig.
Trotzdem sind **Template-Transformation** (Frontmatter/Struktur) und **Ingestion** (RAG/Vector Search) weiterhin relevant.

Diese Notiz dokumentiert, wie der aktuelle Flow im UI aussieht und welche (minimalen) Wege für Integrationstests sinnvoll sind.

## Beobachtungen im UI (`FilePreview`)

- **Dateityp-Erkennung**: `file-preview.tsx` klassifiziert `.md/.mdx/.txt` als `markdown` und behandelt viele „textartige“ Extensions ebenfalls als editierbar.
- **Transformation (Template)**: Der UI-Flow läuft primär über `TransformationDialog` + `BatchTransformService`.
  - Der Dialog akzeptiert **Markdown direkt** (kein Transcript/Resolver nötig).
  - Bei PDFs versucht der Dialog zuerst ein Transcript-Markdown per Resolver zu finden; bei `.md` entfällt das.
- **Ingestion**: In `job-report-tab.tsx` („Veröffentlichen“) wird die Route
  `POST /api/chat/{libraryId}/ingest-markdown` aufgerufen.
  - Damit wird ein vorhandenes Markdown (typischerweise Transformation) ingestiert.

## Beobachtungen im External-Job-Orchestrator (Server)

Die modulare External-Job-Pipeline (`src/lib/external-jobs/*`) ist historisch stark auf PDF/Shadow‑Twin-Artefakte zugeschnitten:

- `preprocess-core.findPdfMarkdown()` nutzt in Teilen noch PDF-Annahmen (`${baseName}.pdf`) als Fallback.
- Template- und Ingest-Preprocessor suchen primär **Transformationen** im Shadow‑Twin-Kontext.

Konsequenz: Ein „Markdown als Quelle“‑Flow ist aktuell **nicht** der natürliche Pfad der External‑Jobs, sondern eher der UI‑Pfad
„Text/Markdown → Template-Transform → Shadow‑Twin → Ingest“.

## Varianten (Lösungsoptionen)

### Variante A: „Ingest-only“ für Markdown

- **Wann sinnvoll**: Markdown-Dateien sind bereits final (Frontmatter vorhanden / keine Template-Struktur nötig).
- **Vorteile**: Minimal, robust, wenig Abhängigkeiten.
- **Risiko**: Template-Transformation wird nicht abgedeckt; Qualitäts-/Strukturregeln (Frontmatter) evtl. nicht erzwungen.

### Variante B: „Template + Ingest“ ohne External-Jobs (UI-nah)

- **Idee**: Serverseitig analog zum UI-Flow:
  - Markdown lesen → Secretary Template-Transformer aufrufen → frontmatter-basiertes Markdown erzeugen
  - Transformation im Shadow‑Twin speichern → Ingestion durchführen
- **Vorteile**: Deckt den fachlich relevanten Pfad für Markdown ab, ohne die External-Job-Pipeline umzubauen.
- **Constraints**: Für deterministische Runs braucht man **Template-Content** (z.B. aus MongoDB); reine „Standard-Template-Name“-Calls
  sind serverseitig nicht überall verfügbar.

### Variante C: External-Job-Orchestrator „mediaType=text/markdown“ erweitern

- **Idee**: External-Jobs so erweitern, dass Markdown als Source (ohne Extract) sauber unterstützt wird:
  - `findPdfMarkdown` generalisieren (kein PDF-Fallback)
  - Job-Typ/Step-Naming für Text/Markdown definieren
  - Template/Ingester direkt auf Source-Markdown anwenden
- **Vorteile**: Einheitliche Pipeline für alle Medien.
- **Nachteil**: Größerer Umbau, mehr Regression-Risiko.

## Aktueller Stand (Implementationsnotiz)

Für Integrationstests wurde der Markdown-Testcase auf **„Template + Ingestion“** ausgerichtet (Variante B),
ohne den External-Job-Orchestrator als Voraussetzung zu erzwingen.

Wichtig: Diese Variante ist **nur** so gut wie die Verfügbarkeit des verwendeten Templates in MongoDB
(Template-Content wird serverseitig geladen). Die End-to-End-Integration mit dem realen Secretary Service
ist ein echter Integrationstest und muss in der Umgebung ausgeführt werden.

