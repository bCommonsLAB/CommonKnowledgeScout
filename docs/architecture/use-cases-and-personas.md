## Ziel

Dieses Dokument beschreibt **Rollen/Personas** und eine **systematische Use‑Case‑Liste** für die artefakt‑zentrierte Pipeline (Variante 3). Es ist so strukturiert, dass sich jeder neue Use Case mit minimaler Redundanz dokumentieren und später implementieren lässt.

## Rollen / Anwendungsbereiche (Personas)

### Archiv-Pro (technisch versiert)

- **Entry Points**: File‑Liste (Single‑File), Batch/Verzeichnis, Monitoring/Traces
- **Ziel**: deterministische Verarbeitung, Resume/Skip, Kontrolle über Policies/Gates, Debugbarkeit, saubere Facetten (Gallery/Archiv)
- **Erwartung an UI**: Optionen sichtbar (Template/Language/Policies), Fehler nachvollziehbar, Artefakt‑Explorer (Shadow‑Twin) schnell erreichbar

### Wizard-User (nicht technisch)

- **Entry Points**: Wizard (Quelle wählen → Template wählen → Start → Ergebnis prüfen → Speichern)
- **Ziel**: sichere Defaults, verständlicher Fortschritt, möglichst wenige Entscheidungen, Ergebnis schnell nutzbar
- **Erwartung an UI**: „Ein Knopf“, klare Statusanzeige (SSE), verständliche Fehlermeldungen, Ergebnis-Preview + „Ergebnis öffnen“

### Automation / Integration

- **Entry Points**: API/Jobs (ohne UI), optional Batch-Automation
- **Ziel**: idempotent, standardisierte Artefakte/Outputs, klare Fehlercodes, robuste Wiederholbarkeit
- **Erwartung an API**: stabile Contracts (Request/Response), Polling oder Webhook, maschinenlesbare Result-Refs (Artefakt-IDs/URLs)

## Use‑Case Liste (systematisch)

### Single‑Source Use Cases (V1 + nahe Roadmap)

- **Audio**: Audio-Datei → Transcript (Originalsprache/TargetLanguage) → Template‑Bericht → Ingest
- **Video**: Video-Datei → (Audio-Extraktion) → Transcript → Template‑Bericht → Ingest
- **YouTube**: YouTube URL → Download/Extract → Transcript → Template‑Bericht → Ingest
- **PDF**: PDF → Mistral OCR (Markdown) + Pages/Images → Template‑Bericht → Ingest
- **Word (DOCX)**: DOCX → Extract (Text/Struktur) → Template‑Bericht → Ingest
- **Excel (XLSX)**: XLSX → Extract (Sheets/Tables) → Template‑Bericht → Ingest

### Single‑Source Use Cases (später, aber vorgesehen)

- **Image**: Bild → OCR → Template‑Bericht → Ingest
- **PowerPoint/Slides**: PPTX/Slides → Extract (Text + Bilder) → Template‑Bericht → Ingest

### Multi‑Source Use Cases (Ausblick; wichtig fürs Zielbild)

- **Event Bundle**: Slides + Vortrag (Video/Audio) + optional Web‑Text + optional PDF/Handout → Bundle‑Korpus → Template‑Bericht → Ingest
  - **Wichtig**: Multi‑Source benötigt eine stabile **Bundle Identity** (z.B. `folderId` oder `wizardSessionId`) für Artefakte/Gates.

## Einheitliche Use‑Case Matrix (Schablone: wie/wo/warum)

Diese Schablone wird pro Use Case ausgefüllt (und pro Persona/Entry‑Point referenziert), um **Redundanzen sichtbar** zu machen und die Implementierung minimal zu halten.

### Matrix-Felder

- **UseCaseId**: z.B. `pdf_mistral_report`, `audio_transcript_report`
- **Persona/EntryPoint**: Archiv-Pro/File‑Liste, Archiv-Pro/Batch, Wizard-User/Wizard, Automation/API
- **Input**
  - `sourceRef` oder `sourceBundle`
  - `templateName`, `targetLanguage`, `policies`
- **Orchestrierung**
  - External Job: `job_type`, `operation`, `worker`
  - Steps/Phasen: `extract → template → ingest`
- **Secretary Calls**
  - Endpoint + Parameter
  - Sync vs Async (Job/Webhook)
  - Erwartetes Callback-Payload (Keys, URLs statt Base64)
- **Artefakte (Shadow Twin)**
  - Extract/Transcript: `{base}.{lang}.md`
  - Transformation: `{base}.{template}.{lang}.md`
  - Assets: pages/images archives (URLs) + Ablagekonvention
- **Gates/Policies**
  - Welche Artefakte skippen welche Phase?
  - Welche Policies überschreiben Gates (`force`)?
- **Persistenz/Publishing**
  - Storage (Artefakte)
  - Mongo (Ingest) + Facetten/Metadaten
- **UI/Ergebnis**
  - Status/Progress (SSE)
  - „Ergebnis öffnen/selektieren“
  - Fehlerdarstellung (verständlich, ohne Internals)

## Matrix (tabellarisch)

Die Tabelle ist bewusst „breit“, damit man pro Use Case **alles auf einen Blick** sieht. Für die Detailausarbeitung (z.B. konkrete Payload-Keys) referenzieren wir dann die Secretary‑Schnittstellen-Doku.

### Vorlage (zum Ausfüllen)

| UseCaseId | Persona/EntryPoint | Input (Quelle+Template) | Orchestrierung (Job) | Secretary Calls (sync/async) | Artefakte (Shadow Twin) | Gates/Policies (Skip/Force) | Persistenz/Publishing | UI/Ergebnis |
|---|---|---|---|---|---|---|---|---|
| `...` | `...` | `sourceRef/sourceBundle; templateName; targetLanguage; policies` | `job_type; operation; worker; steps` | `endpoints; callback/webhook; erwartete keys` | `extract/transcript; transformation; assets` | `gate criteria; policy override` | `storage; mongo ingest; facets` | `SSE progress; open result; error UX` |

### Beispiel (V0) – `pdf_mistral_report` (Archiv‑Pro / File‑Liste)

| UseCaseId | Persona/EntryPoint | Input (Quelle+Template) | Orchestrierung (Job) | Secretary Calls (sync/async) | Artefakte (Shadow Twin) | Gates/Policies (Skip/Force) | Persistenz/Publishing | UI/Ergebnis |
|---|---|---|---|---|---|---|---|---|
| `pdf_mistral_report` | `Archiv-Pro / File-Liste (Single)` | `sourceRef=PDF(itemId,parentId); templateName; targetLanguage=de; policies (extract/metadata/ingest)` | `External Job: job_type=pdf; operation=extract; worker=secretary; steps=extract→template→ingest` | `POST /api/secretary/process-pdf (extractionMethod=mistral_ocr, includePageImages=true, includeOcrImages=true); async: Worker startet; Callback POST /api/external/jobs/{jobId}` | `Extract: {base}.de.md; Transform: {base}.{template}.de.md; Assets: pages/images ZIP per URL/Refs` | `Wenn Transform-Artefakt existiert → template skip (außer force); wenn ingest existiert → ingest skip` | `Storage: Artefakte; Mongo: Ingest (Meta+Chunks) + Facetten` | `SSE /api/external/jobs/stream; nach completed: Ergebnis öffnen/selektieren` |

## Matrix – alle Media Use Cases (vereinheitlicht)

Hinweis zur Vermeidung von Redundanz:
- Die Zeilen sind **medientyp-spezifisch**, aber **entrypoint-neutral**.
- Unterschiede zwischen File‑Liste/Batch/Wizard/API sind überall gleich:
  - **File‑Liste**: genau 1 Quelle starten
  - **Batch/Verzeichnis**: viele Quellen → viele Jobs (oder BatchId)
  - **Wizard**: Quelle wählen + Template wählen → Job starten → SSE + Preview/Save
  - **Automation/API**: Job erstellen → Polling/Webhook → Artefakt‑Refs konsumieren

| UseCaseId | EntryPoints (wer nutzt es) | Input (Quelle+Template) | Orchestrierung (Job) | Secretary Calls (sync/async) | Artefakte (Shadow Twin) | Gates/Policies (Skip/Force) | Persistenz/Publishing | Status/Ergebnis |
|---|---|---|---|---|---|---|---|---|
| `audio_transcript_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=Audio(file); templateName; targetLanguage; policies` | `job_type=audio; operation=transcribe/extract; worker=secretary; steps=extract→template→ingest` | `POST /api/secretary/process-audio; async via External Jobs Callback (V3)` | `Extract: {base}.{lang}.md (Transcript); Transform: {base}.{template}.{lang}.md` | `Skip wenn Transform existiert; force überschreibt` | `Storage Artefakte; optional Ingest` | `SSE job_update; Ergebnis öffnen/selektieren` |
| `video_transcript_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=Video(file); templateName; targetLanguage; policies` | `job_type=video; operation=transcribe/extract; worker=secretary; steps=extract→template→ingest` | `POST /api/secretary/process-video; async via External Jobs Callback (V3)` | `Extract: {base}.{lang}.md; Transform: {base}.{template}.{lang}.md` | `Skip/force wie oben` | `Storage; optional Ingest` | `SSE; Ergebnis öffnen` |
| `youtube_transcript_report` | `Wizard, API` | `sourceRef=YouTube(url); templateName; targetLanguage; policies` | `job_type=video; operation=extract; worker=secretary` | `POST /api/secretary/process-video (url); async via External Jobs Callback (V3)` | `Extract: {base}.{lang}.md; Transform: {base}.{template}.{lang}.md` | `Skip/force wie oben` | `Storage; optional Ingest` | `SSE/Poll; Ergebnis öffnen` |
| `pdf_mistral_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=PDF(file/itemId); templateName; targetLanguage; policies; extractionMethod=mistral_ocr` | `job_type=pdf; operation=extract; worker=secretary; steps=extract→template→ingest` | `POST /api/secretary/process-pdf (mistral_ocr, includePageImages=true, includeOcrImages=true); async Callback` | `Extract: {base}.{lang}.md; Transform: {base}.{template}.{lang}.md; Assets: pages/images ZIP URLs/Refs` | `Skip wenn Transform existiert; force überschreibt; ingest skip wenn vorhanden` | `Storage; optional Ingest (V0 Pflichtfähig)` | `SSE; Ergebnis öffnen` |
| `markdown_file_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=Markdown/TXT(file); templateName; targetLanguage; policies` | `job_type=text; operation=extract/transform; worker=secretary` | `POST /api/secretary/process-text (template)` | `Transform: {base}.{template}.{lang}.md (Extract kann = Source sein)` | `Skip wenn Transform existiert` | `Storage; optional Ingest` | `SSE/Poll oder sync UI` |
| `website_report` | `Wizard, API` | `sourceRef=URL; templateName; targetLanguage; policies` | `job_type=text; operation=extract; worker=secretary` | `POST /api/secretary/import-from-url (extract) → danach POST /api/secretary/process-text (template)` | `Extract: {base}.{lang}.md (raw website text optional); Transform: {base}.{template}.{lang}.md` | `Skip wenn Transform existiert` | `Storage; optional Ingest` | `SSE/Poll; Ergebnis öffnen` |
| `docx_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=DOCX(file); templateName; targetLanguage; policies` | `job_type=document; operation=extract; worker=secretary` | `TBD: Secretary DOCX endpoint (Contract needed)` | `Extract: {base}.{lang}.md; Transform: {base}.{template}.{lang}.md` | `Skip/force wie oben` | `Storage; optional Ingest` | `SSE/Poll; Ergebnis öffnen` |
| `xlsx_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=XLSX(file); templateName; targetLanguage; policies` | `job_type=document; operation=extract; worker=secretary` | `TBD: Secretary XLSX endpoint (Contract needed)` | `Extract: {base}.{lang}.md (tables/sheets); Transform: {base}.{template}.{lang}.md` | `Skip/force wie oben` | `Storage; optional Ingest` | `SSE/Poll; Ergebnis öffnen` |
| `image_ocr_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=Image(file/url); templateName; targetLanguage; policies` | `job_type=image; operation=extract; worker=secretary` | `POST /api/secretary/process-image (OCR) → optional Template Transform` | `Extract: {base}.{lang}.md; Transform: {base}.{template}.{lang}.md` | `Skip/force wie oben` | `Storage; optional Ingest` | `SSE/Poll` |
| `slides_pptx_report` | `File-Liste, Batch, Wizard, API` | `sourceRef=PPTX/Slides(file); templateName; targetLanguage; policies` | `job_type=document; operation=extract; worker=secretary` | `TBD: Secretary PPTX/Slides endpoint (Contract needed)` | `Extract: {base}.{lang}.md (+ slide images refs); Transform: {base}.{template}.{lang}.md` | `Skip/force wie oben` | `Storage; optional Ingest` | `SSE/Poll` |
| `event_bundle_report` | `Wizard, API (später)` | `sourceBundle=multiple sources; templateName; targetLanguage; policies` | `job_type=event; operation=extract+transform; worker=secretary` | `POST /api/secretary/session/process-async (oder events/*) + Callback; ggf. mehrere Extracts + 1 Template` | `Transform: {bundle}.{template}.{lang}.md; Assets: refs; (Bundle Identity zwingend)` | `Skip/force auf Bundle-Artefakt-Ebene` | `Storage; Ingest; Facetten (Event)` | `SSE; Ergebnis öffnen` |


