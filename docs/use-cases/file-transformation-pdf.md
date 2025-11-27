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

## Transformation Phases

### Phase 1: Extract (Extraction)
- **What happens**: PDF → Text + Images extraction
- **Output**: Markdown file without frontmatter (`document.md` - Transcript)
- **Images**: Extracted as ZIP archives or Base64 (Mistral OCR)
- **Shadow-Twin Directory**: Created automatically if images are present (`.document.pdf/`)

### Phase 2: Template/Metadata
- **What happens**: Frontmatter is added and the document is structured (chapters, topics, etc.).
- **Input**: Markdown without frontmatter (`document.md`)
- **Output**: Markdown with frontmatter (`document.de.md` - Transformed)
- **Automatic skipping**:
  - If the document already has chapter metadata (`chapters` in frontmatter), the template phase is skipped.
  - If only `pages` are missing, they are automatically reconstructed from the `--- Seite N ---` markers in the body (no extra analysis needed).

### Phase 3: Ingestion (RAG)
- **What happens**: Markdown → Vector storage, MongoDB
- **Images**: Uploaded to Azure Storage for frontend access
- **Result**: Document is searchable via RAG (Retrieval Augmented Generation)

## Result Structure

### Shadow-Twin Directory (when images are present)

If images are extracted, a Shadow-Twin directory is created:
```
.document.pdf/
├── document.md          (Transcript - Phase 1 output, no frontmatter)
├── document.de.md       (Transformed - Phase 2 output, with frontmatter)
├── page-001.png        (Extracted images)
├── page-002.png
└── ...
```

### Shadow-Twin Files (when no images)
### Shadow-Twin Files (when no images)

If no images are extracted, files are saved directly next to the PDF:
```
document.pdf
document.md          (Transcript - Phase 1 output, no frontmatter)
document.de.md       (Transformed - Phase 2 output, with frontmatter)
```
For more detailed information about the Shadow-Twin structure, see the **Shadow-Twin Architecture Documentation**.

## File Naming Convention

- **Transcript File** (`document.md`): 
  - Created after Phase 1 (Extract)
  - Contains extracted text without frontmatter
  - **No language suffix** (original language of source)
  
- **Transformed File** (`document.de.md`):
  - Created after Phase 2 (Template)
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
