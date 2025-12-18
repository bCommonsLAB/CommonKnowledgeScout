# PDF Transformation

## What is achieved?

Transform PDF files into structured Markdown documents. Text, images, and structure are extracted and saved as searchable Markdown files. The transformation process consists of three phases: **Extract**, **Template/Metadata**, and **Ingestion**.

## Prerequisites

- Active library selected
- PDF file available in Library Browser

## Steps

1. Open the **Library** view
2. Navigate to the folder containing the PDF file
3. Select the PDF file (single file or multiple for batch processing)
4. Click the **Transformation icon** or use the context menu
5. In the transformation dialog:
   - Select the **target language** for transformation
   - Optional: Choose a **template** for structured output
   - Optional: Enable **"Extract OCR images"** for Mistral OCR extracted images
   - Optional: Enable **"Extract page images"** for PDF pages as images
6. Click **"Start Transformation"**
7. Monitor progress in the dialog (three phases: Extract → Template → Ingestion)
8. After completion: The transformed Markdown files (Shadow Twins) appear next to the original

## Transformation Execution Modes

The transformation can run in two modes:

### Asynchronous Mode (Default)
- Used for larger files or when processing requires time
- Creates a background job that processes the PDF in three sequential phases
- Results are delivered via webhooks
- **Creates two separate files**: Transcript (`document.md`) and Transformed (`document.de.md`)

### Synchronous Mode (Legacy/Cache)
- Used for small files or when results are cached
- Returns results immediately in the API response
- **Creates only one file**: Transformed (`document.de.md`) with frontmatter
- No separate transcript file is created

**Note**: The mode is automatically selected based on file size and cache availability. Most transformations use the asynchronous mode.

## Transformation Phases

The three phases are executed sequentially in **asynchronous mode**. In **synchronous mode**, phases 1 and 2 are combined into a single operation.

### Phase 1: Extract (Extraction)
- **What happens**: PDF → Text + Images extraction
- **Output** (async mode): Markdown file without frontmatter (`document.md` - Transcript)
- **Output** (sync mode): Directly proceeds to Phase 2, no separate transcript file
- **Images**: Extracted as ZIP archives or Base64 (Mistral OCR)
- **Shadow-Twin Directory**: Created automatically if images are present (`.document.pdf/`)

### Phase 2: Template/Metadata
- **What happens**: Frontmatter is added and the document is structured (chapters, topics, etc.).
- **Input** (async mode): Markdown without frontmatter (`document.md`)
- **Input** (sync mode): Extracted text directly from Phase 1
- **Output**: Markdown with frontmatter (`document.de.md` - Transformed)
- **Automatic skipping**:
  - If the document already has chapter metadata (`chapters` in frontmatter), the template phase is skipped.
  - If only `pages` are missing, they are automatically reconstructed from the `--- Seite N ---` markers in the body (no extra analysis needed).

#### How Metadata is Extracted via Templates

The template phase uses **LLM-based extraction** to analyze the document content and extract structured metadata:

1. **Template Selection**:
   - Template is selected from MongoDB based on:
     - Job parameters (`job.parameters.template`)
     - Library configuration (`library.config.secretaryService.pdfDefaults.template`)
     - Fallback to default templates if none specified

2. **Template Structure**:
   - Templates contain:
     - **Frontmatter Schema**: Defines metadata fields with placeholders like `{{title|Description}}`
     - **System Prompt**: Instructions for the LLM on how to extract and structure data
     - **Markdown Body**: Optional template structure for the output
   
   Example template field:
   ```yaml
   title: {{title|Vollständiger Titel des Dokuments (extraktiv, aus Heading/Frontseite)}}
   chapters: {{chapters|Array von Kapiteln mit title, level (1–3), order, startPage, endPage, pageCount, summary, keywords}}
   ```

3. **LLM Processing**:
   - The extracted text (from Phase 1) and template content are sent to the **Secretary Service** (`/transformer/template` endpoint)
   - The LLM analyzes the document content according to the system prompt
   - The LLM extracts metadata fields defined in the template frontmatter
   - Returns structured JSON with all metadata fields

4. **Metadata Sources** (as defined in template system prompts):
   - **Document content**: Headings, text, TOC, metadata sections
   - **Filename**: Parsed for author, year, title, topic, source, issue, status
   - **Directory path**: Extracted for document type, series/journal, project, region
   - **Acronym mapping**: Resolves abbreviations from filename/path/document

5. **Response Processing**:
   - The Secretary Service returns `structured_data` as JSON
   - This JSON is normalized and converted to YAML frontmatter
   - Fields are validated and cleaned (e.g., `shortTitle` max 40 chars, slug normalization)

6. **Chapter Analysis** (if chapters missing after template):
   - If the template didn't extract chapters, an additional analysis step runs
   - Calls internal `/api/chat/{libraryId}/analyze-chapters` endpoint
   - Merges detected chapters with any existing chapters
   - Extracts page numbers from `--- Seite N ---` markers in the text

7. **Pages Reconstruction**:
   - **Important**: The `pages` field is **never** computed by the template/LLM
   - Always reconstructed from `--- Seite N ---` markers in the Markdown body
   - Extracts the highest page number found in the document

**Example Flow**:
```
Extracted Text (Phase 1)
    ↓
Template Content (from MongoDB)
    ↓
Secretary Service /transformer/template
    ↓ (LLM analyzes text + template instructions)
Structured JSON Response
    ↓ (normalize & validate)
YAML Frontmatter
    ↓ (merge with existing metadata)
Final Markdown with Frontmatter
```

### Phase 3: Ingestion (RAG)
- **What happens**: Markdown → Vector storage, MongoDB
- **Images**: Uploaded to Azure Storage for frontend access
- **Result**: Document is searchable via RAG (Retrieval Augmented Generation)
- **Note**: Only executed in **asynchronous mode**. In synchronous mode, ingestion must be triggered separately if needed.
- **Note**: Only executed in **asynchronous mode**. In synchronous mode, ingestion must be triggered separately if needed.

## Result Structure

The structure depends on whether images are extracted and which execution mode was used:

### Shadow-Twin Directory (when images are present)

If images are extracted, a Shadow-Twin directory is created:

**Asynchronous mode** (two files):
```
.document.pdf/
├── document.md          (Transcript - Phase 1 output, no frontmatter)
├── document.de.md       (Transformed - Phase 2 output, with frontmatter)
├── page-001.png        (Extracted images)
├── page-002.png
└── ...
```

**Synchronous mode** (one file):
```
.document.pdf/
├── document.de.md       (Transformed - Phase 1+2 combined output, with frontmatter)
├── page-001.png        (Extracted images)
├── page-002.png
└── ...
```

### Shadow-Twin Files (when no images)

If no images are extracted, files are saved directly next to the PDF:

**Asynchronous mode** (two files):
```
document.pdf
document.md          (Transcript - Phase 1 output, no frontmatter)
document.de.md       (Transformed - Phase 2 output, with frontmatter)
```

**Synchronous mode** (one file):
```
document.pdf
document.de.md       (Transformed - Phase 1+2 combined output, with frontmatter)
```

For more detailed information about the Shadow-Twin structure, see the **Shadow-Twin Architecture Documentation**.

## File Naming Convention

- **Transcript File** (`document.md`): 
  - Created after Phase 1 (Extract) in **asynchronous mode only**
  - Contains extracted text without frontmatter
  - **No language suffix** (original language of source)
  - **Not created in synchronous mode** (phases are combined)
  
- **Transformed File** (`document.de.md`):
  - Created after Phase 2 (Template) in **asynchronous mode**
  - Created after Phase 1+2 (combined) in **synchronous mode**
  - Contains text with frontmatter and metadata
  - **With language suffix** (target language for transformation)

## Parameters

- **`includeOcrImages`**: Request Mistral OCR images as Base64 (default: `true` for Mistral OCR)
- **`includePageImages`**: Extract PDF pages as images and return as ZIP archive (default: `true` for Mistral OCR)

## Tips

- Shadow Twins are automatically linked with the original
- Transformation runs in the background - you can continue working
- Errors are displayed in an error message
- Both transcript and transformed files can coexist (different names)
- Shadow-Twin directory is hidden (starts with `.`)

## Further Information

- [Shadow-Twin Architecture Documentation](../architecture/shadow-twin.md)
- [PDF Transformation Phases](../architecture/pdf-transformation-phases.md)
- [Transform Service Documentation](../reference/file-index.md#transform--processing)
- [Batch Operations](batch-operations.md) for multiple files
