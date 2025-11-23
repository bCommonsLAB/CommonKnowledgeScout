# PDF Transformation Phases

## Overview

PDF transformation consists of three sequential phases that convert a PDF file into a searchable, structured document ready for RAG (Retrieval Augmented Generation). Each phase builds upon the previous one, creating intermediate artifacts that can be reused or skipped based on policies.

## Phase 1: Extract (Extraction)

### Purpose

Extract text and images from PDF files using OCR or native text extraction.

### What Happens

1. **PDF Processing**:
   - PDF file is sent to Secretary Service
   - Text extraction via native PDF parsing or OCR (Mistral OCR)
   - Image extraction (if enabled)

2. **Image Processing**:
   - Mistral OCR images: Extracted as Base64 from `mistral_ocr_raw.pages[*].images[*].image_base64`
   - PDF page images: Extracted as ZIP archive (`pages_archive_url` or `pages_archive_data`)
   - Images saved to Shadow-Twin directory (if present)

3. **Markdown Creation**:
   - Extracted text saved as Markdown **without frontmatter**
   - File name: `{originalName}.md` (no language suffix - transcript)

### Input

- PDF file (`document.pdf`)
- Extraction method (`native` or `mistral_ocr`)
- Target language (for OCR)
- Image extraction flags (`includeOcrImages`, `includePageImages`)

### Output

- **Transcript File**: `document.md` (Markdown without frontmatter)
- **Images**: Saved to `.document.pdf/` directory (if images extracted)
- **Shadow-Twin Directory**: Created automatically if images are present

### Code References

- **`src/lib/external-jobs/extract-only.ts`**: Extract-only processing logic
- **`src/lib/external-jobs/images.ts`**: Image extraction and processing
- **`src/lib/transform/image-extraction-service.ts`**: Image extraction service

### Example Output

```
.document.pdf/
├── document.md          (Transcript - extracted text, no frontmatter)
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
   - Frontmatter is generated with chapters, pages, topics, etc.

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

### Code References

- **`src/lib/external-jobs/template-run.ts`**: Template transformation execution
- **`src/lib/external-jobs/template-decision.ts`**: Decision logic for template phase
- **`src/lib/processing/gates.ts`**: Gate checking (skip if frontmatter exists)

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

- Frontmatter already exists and is complete
- Template phase disabled via policy
- Previous job already completed template phase

## Phase 3: Ingestion (RAG)

### Purpose

Ingest transformed Markdown into vector database (Pinecone) and MongoDB for RAG queries.

### What Happens

1. **Markdown Processing**:
   - Transformed Markdown (`document.de.md`) is parsed
   - Chapters are detected and structured
   - Text is chunked for vector storage

2. **Vector Storage**:
   - Chunks are embedded and stored in Pinecone
   - Metadata filters enable chapter-level retrieval

3. **MongoDB Storage**:
   - Document metadata stored in MongoDB
   - Chapter summaries stored for fast retrieval

4. **Image Upload**:
   - Images from Shadow-Twin directory uploaded to Azure Storage
   - URLs stored in metadata for frontend access

### Input

- Transformed Markdown (`document.de.md`)
- Images from Shadow-Twin directory
- Library configuration

### Output

- **Vector embeddings**: Stored in Pinecone
- **Document metadata**: Stored in MongoDB
- **Image URLs**: Azure Storage URLs in metadata

### Code References

- **`src/lib/external-jobs/ingest.ts`**: RAG ingestion pipeline
- **`src/lib/chat/ingestion-service.ts`**: Ingestion service
- **`src/lib/repositories/doc-meta-repo.ts`**: MongoDB document metadata repository

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


