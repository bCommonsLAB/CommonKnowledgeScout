# Analyse: PDF-Transformation – IST-Zustand der 3 Phasen

## Ziel dieser Analyse

Dieses Dokument beschreibt den **IST-Zustand** der PDF-Transformation in drei Phasen (Extract, Template, Ingestion) inklusive der realen Ausführungspfade im Code (Worker, Start-Route, Callback-Route, Library-Module). Es dient ausschließlich der Dokumentation und Entscheidungsgrundlage für die Aktualisierung von `docs/architecture/pdf-transformation-phases.md` – der Code selbst wird hier nicht verändert.

Die Kernfragen:

- Wie werden die drei Phasen im aktuellen System tatsächlich abgearbeitet?
- Welche Dateien / Module sind jeweils beteiligt?
- Wo entstehen Kopplungen zwischen Phasen (Start-Route vs. Callback-Route)?

---

## 1. Orchestrierung auf hoher Ebene (IST)

### 1.1 Beteilige Parteien

- **ExternalJobsWorker**  
  - Datei: `src/lib/external-jobs-worker.ts`  
  - Rolle: Pollt Jobs aus der Queue, ruft für jeden gefundenen Job die Start-Route auf:
    - `POST /api/external/jobs/[jobId]/start`

- **Start-Route**  
  - Datei: `src/app/api/external/jobs/[jobId]/start/route.ts`  
  - Rolle:
    - Lädt die PDF aus dem Storage (über `getServerProvider`)
    - Startet Watchdog und initialisiert Trace/Steps (`extract_pdf`, `transform_template`, `ingest_rag`)
    - Führt ein **Preprocessing** aus (`preprocess`) und entscheidet über Extract/Template/Ingest-only anhand:
      - Shadow-Twin-Gate (`gateExtractPdf`)
      - Phase-Policies (`getPolicies` / `shouldRunExtract`)
      - Job-Parameter `phases` (extract/template/ingest)
    - Ruft den Secretary Service (`/api/pdf/process` oder `/api/pdf/process-mistral-ocr`) mit:
      - PDF-File
      - Callback-URL: `/api/external/jobs/[jobId]`
      - Callback-Token (secret)  
  - WICHTIG: Die Start-Route kann selbst (ohne weiteren Secretary-Request) eine **Ingest-only**-Variante fahren, wenn bereits ein Shadow-Twin mit transformiertem Markdown existiert (siehe Block `runIngestOnly` in der Start-Route).

- **Secretary Service (extern)**  
  - Nicht im Repo, aber zentral im Flow:
  - Endpoints:
    - `/api/pdf/process` (Standard-Extraktion)
    - `/api/pdf/process-mistral-ocr` (Mistral OCR)
    - `/api/pdf/jobs/{job_id}/mistral-ocr-raw` (Download kompletter OCR-Daten)
  - Sendet Callbacks an:
    - `POST /api/external/jobs/[jobId]` mit Payload-Feldern wie `extracted_text`, `pages_archive_url`, `mistral_ocr_raw_url`, `mistral_ocr_raw_metadata`, `mistral_ocr_images_url`.

- **Callback-Route**  
  - Datei: `src/app/api/external/jobs/[jobId]/route.ts`  
  - Rolle: Zentrale Orchestrierung des laufenden Jobs beim Eintreffen eines Callbacks:
    - Liest und validiert Kontext (`readContext`)
    - Autorisiert den Callback (`authorizeCallback`)
    - Handhabt Progress-Events (`handleProgressIfAny`)
    - Entscheidet basierend auf Payload und Policies, welche Phasen tatsächlich ausgeführt werden:
      - Extract-Only (wenn Template & Ingest deaktiviert)
      - Voller Flow: Extract → Template → Ingest
      - Skip-Varianten (z.B. Template-Skip wegen vorhandenem Frontmatter, Ingest-Skip wegen vorhandener Vektoren)

---

## 2. Phase 1 – Extract (IST)

### 2.1 Ablauf

1. **Worker → Start-Route**  
   - Worker (`ExternalJobsWorker`) ruft `POST /api/external/jobs/{jobId}/start` auf.

2. **Start-Route – Vorbereitung**  
   - Lädt Job-Dokument (`ExternalJobsRepository.get`).
   - Startet Watchdog.
   - Lädt PDF aus Storage (`getServerProvider(...).getBinary(src.itemId)`).
   - Führt `preprocess` aus (Span `preprocess` im Trace), um vorhandenes Markdown/Frontmatter zu erkennen.
   - Initialisiert Steps (`extract_pdf`, `transform_template`, `ingest_rag`) via `initializeSteps`.

3. **Extract-Entscheidung in der Start-Route**  
   - Liest Phase-Policies (`getPolicies`) und `job.parameters.phases`.
   - Ruft `gateExtractPdf` auf (`src/lib/processing/gates.ts`), um vorhandene Shadow-Twins (Transcript/Transformed) zu erkennen.
   - Kombiniert Gate + Policy mit `shouldRunExtract` zu `runExtract` / `runTemplate` / `runIngestOnly`.
   - Spezialfälle:
     - **Ingest-only**: Wenn `ingestEnabled` aber weder Extract noch Template laufen müssen, lädt die Start-Route direkt das bereits vorhandene transformierte Markdown aus dem Shadow-Twin und ruft `runIngestion` selbst auf (ohne Secretary-Request).
     - **Extract-skip**: Wenn Gate+Policies sagen, dass Extraktion nicht nötig ist, wird kein Request an den Secretary Service gesendet.

4. **Secretary-Request (nur wenn `runExtract` true)**  
   - Baut `FormData` mit PDF und Parametern, setzt `callback_url` und `callback_token`.
   - Wählt Endpoint:
     - Standard: `/api/pdf/process`
     - Mistral OCR: `/api/pdf/process-mistral-ocr` (mit `includeImages` / `includePageImages`).

5. **Secretary → Callback-Route**  
   - Secretary sendet einen oder mehrere Callbacks an `/api/external/jobs/{jobId}` mit:
     - `data.extracted_text`
     - optional `pages_archive_url`, `pages_archive_data`, `images_archive_url`, `images_archive_data`, `mistral_ocr_raw_url`, `mistral_ocr_raw_metadata`, `mistral_ocr_raw`, `mistral_ocr_images_url`.

6. **Callback-Route – Extract-Verarbeitung**  
   - Extrahiert `extracted_text` und Bild-Archiv-Informationen.
   - Markiert den Step `extract_pdf` als `completed`, sobald ein stabiles OCR-Ergebnis vorhanden ist.
   - Führt je nach Phasen-Flags drei Wege:
     - **Extract-Only**: `templatePhaseEnabled === false` und `ingestPhaseEnabled === false` → ruft `runExtractOnly` mit allen Bildquellen auf, speichert Transcript-Markdown OHNE Frontmatter und Bilder im Shadow-Twin, setzt Jobstatus auf `completed`.
     - **Normaler Flow**: Setzt nur Extract-Step auf `completed` und übergibt Ergebnisse an die weiteren Phasen.
     - **Noop**: Wenn kein finales Payload (nur Heartbeats/Progress), macht nichts außer Watchdog-Bump.

### 2.2 Relevante Dateien

- Worker:
  - `src/lib/external-jobs-worker.ts` – findet Jobs und ruft Start-Route auf.
- Start-Route:
  - `src/app/api/external/jobs/[jobId]/start/route.ts` – initialisiert Job, führt Preprocess und Gate-Logik aus, ruft Secretary-Endpoints auf, enthält Ingest-only-Sonderpfad.
- Callback-Route:
  - `src/app/api/external/jobs/[jobId]/route.ts` – verarbeitet `extracted_text`, Markierung des Extract-Steps, Extract-Only Modus.
- Library-Module:
  - `src/lib/external-jobs/extract-only.ts` – Implementierung des Extract-Only Flows (Transcript speichern, Bilder verarbeiten, Job abschließen).
  - `src/lib/external-jobs/images.ts` – Bildverarbeitung aus allen Quellen (pages-Archive, images-Archive, Mistral OCR).
  - `src/lib/external-jobs/storage.ts` – Speichern von Markdown im Shadow-Twin/Parent.
  - `src/lib/processing/gates.ts` – `gateExtractPdf` zur Prüfung vorhandener Shadow-Twins.
  - `src/lib/external-jobs/preprocess.ts` – Voranalyse vorhandener Artefakte (Markdown/Frontmatter).

---

## 3. Phase 2 – Template (IST)

### 3.1 Ablauf

1. **Trigger**  
   - Phase 2 wird **nicht** durch einen separaten HTTP-Endpoint gestartet, sondern immer innerhalb der **Callback-Route** (`POST /api/external/jobs/[jobId]`), nachdem Extract-Daten vorliegen (direkt oder über Shadow-Twin).

2. **Preprocess & Policies**  
   - In der Callback-Route wird (falls noch nicht geschehen) `preprocess` erneut ausgeführt, um vorhandene Frontmatter-Qualität zu bewerten.
   - Policies für die Template-Phase werden über `readPhasesAndPolicies` gelesen (Modul `src/lib/external-jobs/policies.ts`).

3. **Gate- und Entscheidungslogik**  
   - Frontmatter-Vollständigkeit aus dem Callback-Body wird geprüft (`body.data.metadata` mit `chapters` und `pages`).
   - `decideTemplateRun` (in `src/lib/external-jobs/template-decision.ts`) kombiniert:
     - Policies (`metadata: force/skip/auto/ignore`)
     - Gate-Status (`gateTransformTemplate`)
     - Preprocess-Ergebnis (Frontmatter gültig/ungültig)
     - Callback-Phase (`phase === 'template_completed'`)
     - Reparatur-Bedarf eines vorhandenen Shadow-Twins (unvollständiges Frontmatter).
   - Ergebnis: `shouldRunTemplate` + Begründung.

4. **Template-Transformation (falls `shouldRunTemplate` true)**  
   - Callback-Route:
     - Wählt Template-Datei über `pickTemplate` (`src/lib/external-jobs/template-files.ts`).
     - Ruft `runTemplateTransform` auf (`src/lib/external-jobs/template-run.ts`).
   - `runTemplateTransform`:
     - Baut Request an Secretary Template-Transformer (`/transformer/template`).
     - Parst Response und normalisiert `structured_data` zu `Frontmatter`.

5. **Kapitel-Analyse & Merge**  
   - Callback-Route ruft `analyzeAndMergeChapters` (`src/lib/external-jobs/chapters.ts`) auf, um:
     - Kapitel im Text zu analysieren.
     - Bestehende Kapitel aus altem Frontmatter mit neuen zu mergen.
     - Konsistente Kapitelbereiche (startPage/endPage/pageCount) herzustellen.

6. **Markdown mit Frontmatter speichern**  
   - Frontmatter wird mit SSOT-Feldern angereichert (job_id, source_file, template_status etc.).
   - `stripAllFrontmatter` entfernt alte Frontmatter-Blöcke aus dem Text.
   - `createMarkdownWithFrontmatter` (aus `@/lib/markdown/compose`) erzeugt Markdown mit neuem Frontmatter.
   - `saveMarkdown` speichert `{baseName}.{lang}.md` im Shadow-Twin- oder Parent-Verzeichnis.
   - Step `transform_template` wird am Ende zuverlässig auf `completed`/`failed` gesetzt.

7. **Skip-Fälle**  
   - Wenn Template-Phase geskippt wird (z.B. vollständiges Frontmatter im Body, oder Gate sagt „frontmatter_complete“):
     - Die Callback-Route übernimmt direkt das bereits vorhandene Frontmatter (z.B. aus `body.data.metadata`) als Basis für Ingestion.

### 3.2 Relevante Dateien

- Callback-Route:
  - `src/app/api/external/jobs/[jobId]/route.ts` – enthält gesamte Template-Orchestrierung.
- Library-Module:
  - `src/lib/external-jobs/template-run.ts` – HTTP-Aufruf des Template-Transformers, Parsing/Normalisierung der Antwort.
  - `src/lib/external-jobs/template-decision.ts` – Entscheidung, ob Template überhaupt laufen soll (inkl. Reparaturfälle).
  - `src/lib/external-jobs/chapters.ts` – Analyse/Merge von Kapiteln.
  - `src/lib/external-jobs/template-files.ts` – Auswahl des Template-Files.
  - `src/lib/processing/gates.ts` – `gateTransformTemplate` (Frontmatter bereits vollständig?).
  - `src/lib/external-jobs/preprocess.ts` – Frontmatter-Qualität vor der Template-Phase.
  - `src/lib/external-jobs/storage.ts` – Speichern des transformierten Markdown.

---

## 4. Phase 3 – Ingestion (IST)

### 4.1 Ablauf

1. **Trigger**  
   - Phase 3 wird ebenfalls **innerhalb der Callback-Route** gestartet, nachdem:
     - Ein Shadow-Twin mit transformiertem Markdown existiert (entweder neu geschrieben oder wiederverwendet), und
     - Die Template-Phase entweder erfolgreich war oder explizit übersprungen wurde, aber ausreichende Metadaten vorliegen.
   - Zusätzlich existiert ein Ingest-only Pfad:
     - In der Start-Route (`runIngestOnly`) **ohne** neuen Secretary-Request, wenn bereits ein transformiertes Shadow-Twin-Markdown existiert.

2. **Gate-Logik**  
   - `gateIngestRag` (`src/lib/processing/gates.ts`) prüft über einen `ingestionCheck`-Callback, ob bereits Vektoren für diese Datei in der MongoDB Vector Search Collection existieren:
     - Verwendung von `loadLibraryChatContext` und MongoDB Query (Filter nach `kind: 'meta'`, `userEmail`, `libraryId`, `fileId`).
   - Ergebnis:
     - Wenn Vektoren schon existieren → Ingestion-Step als `completed` mit Details `{ skipped: true, reason: 'ingest_exists' }`.

3. **Policy-Entscheidung**  
   - In der Callback-Route werden zusätzlich „leichte“ Ingestion-Policies evaluiert:
     - `ingestPolicy: 'do' | 'force' | 'skip'` plus Legacy-Flags (`doIngestRAG`, `phases.ingest`, `policies.ingest`).
   - Daraus wird `useIngestion` abgeleitet.

4. **Markdown für Ingestion laden**  
   - Primärquelle: frisch erzeugtes transformiertes Markdown (Text im Callback oder soeben gespeicherte Datei).
   - Fallback: Laden der transformierten Datei `{baseName}.{lang}.md` aus Storage, falls `extractedText` nicht mehr vorliegt.

5. **Ingestion ausführen**  
   - `runIngestion` (`src/lib/external-jobs/ingest.ts`) ruft:
     - `IngestionService.upsertMarkdown(userEmail, libraryId, fileId, fileName, markdown, meta, jobId)`  
       (in `src/lib/chat/ingestion-service.ts`)
   - Ergebnis:
     - `chunksUpserted`, `docUpserted`, `index`.
   - Die Callback-Route:
     - Speichert Ingestion-Metadaten im Job (`setIngestion`).
     - Aktualisiert Step `ingest_rag` auf `completed`.

6. **Job-Abschluss**  
   - `setJobCompleted` (`src/lib/external-jobs/complete.ts`) setzt Jobstatus und Ergebnis.
   - Shadow-Twin-State wird auf `processingStatus: 'ready'` gesetzt.
   - `JobEventBus` schickt ein final `job_update` Event inkl. `refreshFolderIds`.

### 4.2 Relevante Dateien

- Start-Route:
  - `src/app/api/external/jobs/[jobId]/start/route.ts` – Ingest-only Pfad (`runIngestOnly`) ohne Secretary-Request.
- Callback-Route:
  - `src/app/api/external/jobs/[jobId]/route.ts` – reguläre Ingestion nach Template-Phase.
- Library-Module:
  - `src/lib/external-jobs/ingest.ts` – Wrapper für RAG-Ingestion.
  - `src/lib/chat/ingestion-service.ts` – konkrete Upsert-Logik in MongoDB Vector Search.
  - `src/lib/repositories/vector-repo.ts` – MongoDB Vector Search Repository.
  - `src/lib/processing/gates.ts` – `gateIngestRag`.
  - `src/lib/external-jobs/complete.ts` – finaler Jobabschluss inkl. Events.

---

## 5. Dokumentations-Varianten für `pdf-transformation-phases.md`

### Variante A – Minimal-invasiv (empfohlen)

- Behalte die bestehende Struktur (Phase 1/2/3) bei.
- Ergänze pro Phase:
  - Einen kurzen Unterpunkt **„Execution in Code (IST)“** mit:
    - Nennung der beteiligten Routen (Start/Callback).
    - Hinweis auf Worker/Secretary.
    - Liste der wichtigsten Module.
- Ergänze unter „Overview“ eine kleine Tabelle „Who does what?“ (Worker, Start-Route, Callback-Route, Secretary).
- Vorteil: Wenig Änderungen, Doku bleibt kompakt, aber realitätsnäher.

### Variante B – Stärkere Orchestrierungs-Sektion

- Ergänze oberhalb der Phasen eine neue Sektion **„Runtime Orchestration“**:
  - Sequenzielle Beschreibung: Worker → Start-Route → Secretary → Callback-Route.
  - Danach pro Phase nur noch die fachliche Sicht, aber mit Verweis auf diese neue Sektion.
- Vorteil: Klarer Unterschied zwischen fachlicher Phase (Konzept) und technischer Ausführung (Routen/Module).
- Nachteil: Etwas mehr Text, zwei Stellen zu pflegen (Orchestrierung + Phasen).

### Variante C – Aufsplitten in mehrere Dokumente

- Lasse `pdf-transformation-phases.md` bewusst fachlich.
- Erstelle separate Datei(en) unter `docs/architecture/phases/*` mit rein technischer Sicht:
  - `phase-1-extract.md`, `phase-2-template.md`, `phase-3-ingest.md`, `overview.md`.
- Vorteil: Sehr klare Trennung von Domänen- vs. Implementierungswissen.
- Nachteil: Mehr Streuung, höherer Pflegeaufwand, aktuell overkill.

---

## 6. Gewählte Variante für das nächste Update

Für das unmittelbare Update von `docs/architecture/pdf-transformation-phases.md` wähle ich **Variante A (minimal-invasiv)**:

- Ergänzung einer kompakten Orchestrierungs-Übersicht in der **Overview**.
- Pro Phase:
  - Erweiterung der bestehenden „Code References“ um:
    - Start-Route / Callback-Route.
    - Worker (für Phase 1) und Secretary Service als externe Partei.
  - Ein kurzer Absatz **„Execution in Code (IST)“**, der die reale Abarbeitung beschreibt, ohne in Implementierungsdetails abzudriften.

Die folgenden Änderungen an `pdf-transformation-phases.md` orientieren sich genau an diesem Plan.







