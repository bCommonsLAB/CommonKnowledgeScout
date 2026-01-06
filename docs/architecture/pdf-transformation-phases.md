# PDF Transformation Phases

## Overview

PDF transformation consists of three sequential phases that convert a PDF file into a searchable, structured document ready for RAG (Retrieval Augmented Generation). Each phase builds upon the previous one, creating intermediate artifacts that can be reused or skipped based on policies.

In the **current implementation (IST)**, these three phases are not executed via three separate HTTP endpoints, but through a combination of:

- **Worker**: `src/lib/external-jobs-worker.ts` – polls jobs and calls the start route
- **Start route**: `src/app/api/external/jobs/[jobId]/start/route.ts` – initializes the job and starts Phase 1 (Extract) or an ingest-only path
- **Secretary Service (external)** – performs PDF/OCR/template transformation and sends webhooks back
- **Callback route**: `src/app/api/external/jobs/[jobId]/route.ts` – processes webhooks and orchestrates Phase 1–3 (Extract, Template, Ingestion)

### Runtime Orchestration (high level)

```text
Worker (jobs queue)
  ↓ POST /api/external/jobs/{jobId}/start
Start route
  - loads PDF from storage
  - decides Extract/Template/Ingest-only via gates + policies
  - calls Secretary Service (PDF/OCR)
  ↓ Webhook: POST /api/external/jobs/{jobId}
Secretary Service (external)
  - extracts text/images
  - sends extracted_text, pages_archive_url, mistral_ocr_raw_url, ...
  ↓
Callback route
  - processes extract result (Phase 1)
  - runs or skips template phase (Phase 2)
  - runs or skips ingestion (Phase 3)
```

## Phase 1: Extract (Extraction)

### Purpose

Extract text and images from PDF files using OCR or native text extraction.

### What Happens

1. **PDF Processing**:
   - PDF file is sent to Secretary Service
   - Text extraction via native PDF parsing or OCR (Mistral OCR)
   - Image extraction (if enabled)

2. **Image Processing**:
   - Mistral OCR images: Extracted via `mistral_ocr_images_url` (ZIP archive) - separate from `mistral_ocr_raw`
   - PDF page images: Extracted as ZIP archive (`pages_archive_url` or `pages_archive_data`)
   - Images saved to Shadow-Twin directory (if present)
   - **Note**: Asynchronous webhook sends `mistral_ocr_raw_url` and `mistral_ocr_raw_metadata` only. Full `mistral_ocr_raw` data must be downloaded via `GET /api/pdf/jobs/{job_id}/mistral-ocr-raw`

3. **Markdown Creation**:
   - Extracted text saved as Markdown **without frontmatter**
   - File name (v2): `{baseName}.{language}.md` (transcript, language suffix)

### Input

- PDF file (`document.pdf`)
- Extraction method (`native` or `mistral_ocr`)
- Target language (for OCR)
- Image extraction flags (`includeOcrImages`, `includePageImages`)

### Output

- **Transcript File**: `document.de.md` (Markdown without frontmatter; language suffix)
- **Images**: Saved to `.document.pdf/` directory (if images extracted)
- **Shadow-Twin Directory**: Created automatically if images are present

### Code References (IST)

- **Worker & routes**
  - **`src/lib/external-jobs-worker.ts`**: Background worker that polls jobs from the queue and triggers the start route (`POST /api/external/jobs/[jobId]/start`)
  - **`src/app/api/external/jobs/[jobId]/start/route.ts`**: Start route; loads the PDF from storage, sets watchdog/steps, calls Secretary Service (standard or Mistral OCR endpoint) and can run an ingest-only flow
  - **`src/app/api/external/jobs/[jobId]/route.ts`**: Callback route; processes webhooks from Secretary Service (including `extracted_text`, `pages_archive_url`, `mistral_ocr_raw_url`) and decides whether to run Extract-only, Extract+Template+Ingest or a skip path
- **Extract-Phase (Core-Module)**
  - **`src/lib/external-jobs/extract-only.ts`**: Extract-only processing logic (Transcript speichern, Bilder verarbeiten, Job abschließen)
  - **`src/lib/external-jobs/images.ts`**: Image extraction and processing (pages-Archive, images-Archive, Mistral OCR)
  - **`src/lib/external-jobs/storage.ts`**: Markdown storage in the shadow twin or parent folder
  - **`src/lib/processing/gates.ts`** (`gateExtractPdf`): Gate that checks whether a shadow twin (transcript or transformed) already exists and allows Extract to be skipped
  - **`src/lib/transform/image-extraction-service.ts`**: Image extraction service (deeper image-processing pipeline)

### Execution in Code (IST)

- **Start route**
  - Loads the PDF from storage via `getServerProvider`.
  - Runs preprocessing and initializes steps (`extract_pdf`, `transform_template`, `ingest_rag`).
  - Calls `gateExtractPdf` and phase policies to decide:
    - whether Extract should actually be sent to Secretary Service (`runExtract`),
    - whether only Template/Ingestion should run,
    - whether an **ingest-only** path without a new Secretary call is possible.
  - When `runExtract` is true, sends an HTTP request to Secretary Service (`/api/pdf/process` or `/api/pdf/process-mistral-ocr`) with `callback_url` = `/api/external/jobs/{jobId}`.

- **Callback route**
  - Receives webhooks with `extracted_text` and image archives.
  - Marks `extract_pdf` as completed as soon as a stable OCR result is available.
  - If template and ingest phases are explicitly disabled, calls `runExtractOnly`, stores the transcript without frontmatter and optionally processes images.
  - In all other cases it only ensures that Phase 1 is completed and passes the results to the template/ingestion logic.

### Example Output

```
.document.pdf/
├── document.de.md       (Transcript - extracted text, no frontmatter)
├── page-001.png        (Extracted images)
└── page-002.png
```

## Phase 2: Template (Metadata)

### Purpose

Add structured metadata (frontmatter) to the extracted text, enabling structured queries and RAG integration.

### What Happens

1. **Template Processing**:
   - Transcript Markdown (`document.md`) is sent to Secretary Service template transformer
   - LLM analyzes content and extracts structured metadata
   - Frontmatter is generated with chapters, topics etc.
   - **The total page count (`pages`) is not computed by the template but always reconstructed from the `--- Seite N ---` markers in the Markdown body.**

2. **Markdown Creation**:
   - Transcript content + frontmatter = transformed Markdown
   - File name: `{originalName}.{language}.md` (with language suffix - transformed)

### Input

- Transcript Markdown (`document.md`)
- Template content (structured schema)
- Target language

### Output

- **Transformed File**: `document.de.md` (Markdown with frontmatter)
- **Metadata**: Structured data in YAML frontmatter

### Code References (IST)

- **Routes & orchestration**
  - **`src/app/api/external/jobs/[jobId]/route.ts`**: Central callback route that, after receiving extract results, decides whether the template phase runs or is skipped and then saves the transformed Markdown.
- **Template phase (core modules)**
  - **`src/lib/external-jobs/phase-template.ts`**: Consolidated template phase (decision logic, repair cases, saving transformed Markdown)
  - **`src/lib/external-jobs/template-run.ts`**: Template transformation execution (calls the Secretary template transformer and parses the response)
  - **`src/lib/external-jobs/chapters.ts`**: Chapter detection and merge based on text
  - **`src/lib/external-jobs/template-files.ts`**: Template-Auswahl für External Jobs (**MongoDB Source of Truth**), serialisiert Secretary-kompatibel (ohne `creation`)
  - **`src/lib/templates/template-service-mongodb.ts`**: MongoDB Template-Service inkl. Serialisierung zu Template-Markdown (Frontmatter + Body + systemprompt)
  - **Hinweis (Legacy)**: `src/lib/templates/template-service.ts` lädt Templates aus dem Library-Storage `/templates` Ordner und wird primär für Import/Migration genutzt.
  - **`src/lib/processing/gates.ts`** (`gateTransformTemplate`): Gate checking (e.g. skip if chapter metadata already exists)
  - **`src/lib/external-jobs/storage.ts`**: Saves transformed Markdown (`{originalName}.{language}.md`)

### Execution in Code (IST)

- **Callback route**
  - Runs a preprocess span (if not already present) to detect existing frontmatter and its quality.
  - Reads policies and phase flags via `readPhasesAndPolicies` and `job.parameters.phases`.
  - Determines from the callback body whether chapter metadata (`chapters`) is already present.
  - Calls the consolidated template phase (`runTemplatePhase` in `phase-template.ts`), which:
    - combines policies (`metadata: force/skip/auto/ignore`),
    - gates (`gateTransformTemplate`), and
    - the repair needs of an existing shadow twin.
  - **Template transformation is only executed if no chapter metadata (`chapters`) exists yet.** If only `pages` are missing, they are reconstructed from the `--- Seite N ---` markers in the body.
  - When template processing is executed:
    - it selects a template from **MongoDB** (TemplateDocument) and serialisiert es als Secretary-kompatibles Template-Markdown (ohne `creation`),
    - calls the Secretary template endpoint and adds chapter information,
    - strips old frontmatter and stores the new Markdown with frontmatter via `saveMarkdown` as `{originalName}.{language}.md`,
    - and reliably marks the `transform_template` step as `completed` or `failed`.
  - When the template phase is skipped (chapters already exist), only missing `pages` are reconstructed and the existing frontmatter is used directly as the basis for ingestion.

### Example Output

```markdown
---
title: "Document Title"
pages: 42
chapters:
  - title: "Chapter 1"
    page: 1
  - title: "Chapter 2"
    page: 15
---
# Document Title

[Extracted content...]
```

### Skip Conditions

- Chapter metadata (`chapters`) already exists (frontmatter is complete with respect to chapters).
- Template phase disabled via policy.
- Previous job already completed the template phase.

If only the page count (`pages`) is missing, the template phase is skipped and `pages` is silently reconstructed from the `--- Seite N ---` markers in the body.

## Phase 3: Ingestion (RAG)

### Purpose

Ingest transformed Markdown into MongoDB Atlas Vector Search for RAG queries.

### What Happens

1. **Markdown Processing**:
   - Transformed Markdown (`document.de.md`) is parsed
   - Images are processed and uploaded to Azure Storage (Slides, Cover, Markdown images)
   - Final Markdown (with Azure image URLs) is stored in MongoDB

2. **Vector Storage**:
   - **Complete document** is sent to Secretary Service RAG API (`/api/rag/embed-text`)
   - Secretary Service performs Markdown-aware chunking and embedding generation
   - Chunks with embeddings are received and stored in MongoDB Vector Search Collection
   - Meta-documents (without embeddings) are stored alongside chunks for gallery display
   - Facet metadata is duplicated into chunks for direct filtering during vector search

3. **MongoDB Storage**:
   - All data stored in MongoDB: Meta-documents, chunks, and chapter summaries in same collection
   - Collection structure: `vectors__${libraryId}` per library
   - Document metadata stored as `kind: 'meta'` documents (no embeddings)
   - Chapter summaries stored as `kind: 'chapterSummary'` documents (with embeddings)

4. **Image Upload (Shadow-Twin → Azure Storage)**:
   - All image handling in Phase 3 is based on the **Shadow-Twin directory** and is centralized in the ingestion service.
   - **Session-mode documents (events with slides)**:
     - `docMetaJson.slides[].image_url` is interpreted as a reference into the Shadow-Twin.
     - Each slide image is resolved via `findShadowTwinImage`, uploaded to Azure Storage under the scoped path `…/{libraryId}/sessions/{fileId}/{hash}.{ext}` and de-duplicated by hash.
     - The resulting Azure URLs replace the original `slides[].image_url` values and are used directly by the frontend (`EventSlides`).
   - **Book-mode documents (no slides)**:
     - A **cover image** is detected in the Shadow-Twin directory (`preview_001.jpg`), uploaded to Azure under `…/{libraryId}/books/{fileId}/{hash}.{ext}` and stored as `docMetaJson.coverImageUrl`; this field is also available as a facet and is used by the gallery and book-detail views.
     - Inline images in the Markdown body (Markdown `![]()`, HTML `<img>` and Obsidian `<img-x.ext>` syntax) are resolved against the Shadow-Twin, uploaded to Azure under the `books` scope and **all references in the Markdown are rewritten** to use the Azure URLs.
   - Frontend components (gallery cards, document detail, markdown viewer) use **only these Azure URLs**; direct access to Shadow-Twin image files from the browser is no longer required.

### Input

- Transformed Markdown (`document.de.md`)
- Shadow-Twin directory (transcript, transformed Markdown, extracted images)
- Library configuration (including ingestion policies and facets)
- Storage provider + `shadowTwinFolderId` from the job’s `shadowTwinState`

### Output

- **Vector embeddings**: Stored in MongoDB Vector Search Collection (`vectors__${libraryId}`)
- **Document metadata**: Stored as meta-documents (`kind: 'meta'`) in same collection
- **Image URLs**: Azure Storage URLs in metadata

### Code References (IST)

- **Routes & orchestration**
  - **`src/app/api/external/jobs/[jobId]/start/route.ts`**: Can execute an ingest-only path if a transformed shadow-twin Markdown already exists (without another Secretary request).
  - **`src/app/api/external/jobs/[jobId]/route.ts`**: Runs the regular ingestion after the template phase (including gates, policies, and error handling).
- **Ingestion phase (core modules)**
  - **`src/lib/external-jobs/ingest.ts`**: RAG ingestion pipeline (wrapper around the ingestion service)
  - **`src/lib/chat/ingestion-service.ts`**: Ingestion service (Secretary Service RAG API integration, MongoDB Vector Search upsert, **image processing and Azure upload** via `processSlideImagesToAzure`, `processMarkdownImagesToAzure`, `processCoverImageToAzure`)
  - **`src/lib/chat/rag-embeddings.ts`**: RAG embedding abstraction (Secretary Service client wrapper)
  - **`src/lib/secretary/client.ts`**: Secretary Service client (`embedTextRag()` for RAG API)
  - **`src/lib/repositories/vector-repo.ts`**: MongoDB Vector Search repository (upsert, query, meta-documents)
  - **`src/lib/processing/gates.ts`** (`gateIngestRag`): Gate checking (skip if already ingested; uses MongoDB query)
  - **`src/lib/external-jobs/complete.ts`**: Job completion handler (status, result, events)
- **Storage & metadata**
  - **`src/lib/repositories/doc-meta-repo.ts`**: MongoDB document metadata repository (incl. `coverImageUrl`)
  - **`src/lib/storage/shadow-twin.ts`**: Shadow-Twin utilities (`findShadowTwinImage`, `resolveShadowTwinImageUrl`) for resolving images by relative path
  - **`src/lib/services/azure-storage-service.ts`**: Azure Storage client (scoped blob paths `books` / `sessions`, hash-based de-duplication)

### Execution in Code (IST)

- **Start route (ingest-only path)**
  - If policies/gates decide that Extract/Template are not needed but ingestion should run:
    - it searches for the already transformed Markdown in the shadow twin (directory first, then file),
    - loads the Markdown text and parses frontmatter via `parseSecretaryMarkdownStrict`,
    - calls `runIngestion` directly and completes the job after successful ingestion.

- **Callback route (regular path)**
  - Uses `gateIngestRag` and optionally `ingestionCheck` to determine whether vectors for this document already exist in the MongoDB Vector Search collection.
  - Reads ingestion policies (`ingestPolicy: 'do' | 'force' | 'skip'` plus legacy flags from `job.parameters`).
  - Determines `useIngestion` and marks `ingest_rag` as `skipped` if appropriate (including reason).
  - When ingestion runs:
    - determines `fileId` and `fileName` of the document to ingest,
    - loads Markdown for ingestion (directly from the current callback context or via storage fallback),
    - calls `runIngestion`, which:
      - calls `IngestionService.upsertMarkdown(...)`,
      - stores chunks in Pinecone, and
      - writes metadata (including chapter summaries) to MongoDB,
    - updates the ingestion status in the job (`setIngestion`) and sets the `ingest_rag` step to `completed`.
  - Finally calls `setJobCompleted`, updates the shadow-twin state to `processingStatus: 'ready'` and sends a final `job_update` event with `refreshFolderIds`.

### Skip Conditions

- Document already ingested (check via `ingestionCheck`)
- Ingestion phase disabled via policy

## Phase Control

### Policies

Phases can be controlled via policies:

```typescript
interface PhasePolicies {
  extract: 'force' | 'skip' | 'auto' | 'ignore';
  metadata: 'force' | 'skip' | 'auto' | 'ignore';
  ingest: 'force' | 'skip' | 'auto' | 'ignore';
}
```

- **`force`**: Always execute phase (even if artifacts exist)
- **`skip`**: Skip phase (even if artifacts don't exist)
- **`auto`**: Execute if needed (check gates)
- **`ignore`**: Phase disabled

### Gates

Gates check if phases should be skipped:

- **`gateExtractPdf()`**: Checks for existing Shadow-Twin files
- **`gateTransformTemplate()`**: Checks for existing frontmatter
- **`gateIngestRag()`**: Checks for existing ingestion

### Execution Flow

```
PDF File
  ↓
[Gate: Extract] → Skip if Shadow-Twin exists
  ↓
Phase 1: Extract → document.md + images
  ↓
[Gate: Template] → Skip if frontmatter exists
  ↓
Phase 2: Template → document.de.md
  ↓
[Gate: Ingestion] → Skip if already ingested
  ↓
Phase 3: Ingestion → Vector storage + MongoDB
  ↓
Complete
```

## File Naming Convention

### Transcript File (Phase 1)

- **Format**: `{originalName}.md`
- **Example**: `document.md`
- **Language**: No suffix (original language)
- **Content**: Extracted text without frontmatter

### Transformed File (Phase 2)

- **Format**: `{originalName}.{language}.md`
- **Example**: `document.de.md`
- **Language**: With suffix (target language)
- **Content**: Text with frontmatter and metadata

### Why Different Names?

- **Transcript**: Original language, no transformation → no language suffix
- **Transformed**: Translated/structured, target language → language suffix
- **Coexistence**: Both files can exist simultaneously (no overwrite)

## Error Handling

- **Phase failures**: Logged in job document, job status set to `failed`
- **Partial completion**: Intermediate artifacts preserved
- **Retry**: Failed phases can be retried independently
- **Skip on error**: Subsequent phases can still execute if previous phase failed (depending on policy)

## Performance Considerations

- **Parallel processing**: Images processed in parallel with text extraction
- **Caching**: Secretary Service caches OCR results
- **Batch processing**: Multiple PDFs processed in parallel
- **Incremental updates**: Only changed phases re-executed


