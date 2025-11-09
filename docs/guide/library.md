---
title: Using the Library
---

# Using the Library

This guide explains the library view from a user perspective: structure, navigation, and common tasks.

## Prerequisites
- At least one library is configured in settings: `/settings` → "Library" and "Storage" sections.

## View Structure
- **Header**: Library switcher, settings, upload, breadcrumb.
- **Sidebar (File Tree)**: Folder structure of the active library.
- **File List**: Contents of the selected folder, sorting/filtering/multi-selection.
- **Preview**: File preview (Audio/Markdown/Image) and context-related actions.

## Common Tasks
- **Switch Library**: Select library in the header.
- **Navigate Folders**: Click in the file tree; breadcrumb allows quick navigation back.
- **Upload Files**: Upload in header or drag & drop into the list.
- **Preview/Play**: Select file → right preview (Audio player, Markdown, Image).
- **Transform/Transcribe**: Select file → trigger action in context menu/toolbar.
- **Search/Filter**: Use search field and filters above the list.

## Tips
- **Multi-selection**: Use Ctrl/Shift to select multiple files.
- **Large Directories**: Filter first, then perform actions.

## Transformation {#transformation}

The library supports transforming various file formats into structured Markdown documents. Transformed files are saved as "Shadow Twins" alongside the original files.

### Supported File Formats

#### PDF Documents
- **Extraction**: Text, images, and structure are extracted from PDF documents
- **Methods**: Native extraction or OCR-based extraction
- **Result**: Markdown file with chapters, table of contents, and metadata
- **Options**: 
  - Select target language
  - Extract images
  - Use template for structured output

#### Audio Files
- **Transcription**: Audio files are transcribed to text
- **Language Recognition**: Automatic language recognition or manual selection
- **Result**: Markdown file with transcription and optional speaker identification
- **Supported Formats**: MP3, WAV, and other common audio formats

#### Video Files
- **Transcription**: Video transcripts are extracted
- **Audio Extraction**: Audio is extracted for transcription
- **Result**: Markdown file with video transcript and metadata
- **Supported Formats**: MP4 and other common video formats

#### Images
- **OCR**: Text is extracted from images using OCR
- **Description**: Optional image description with AI
- **Result**: Markdown file with extracted text and description
- **Supported Formats**: PNG, JPG, JPEG

### Workflow

1. **Select File**: Choose a file in the file list
2. **Start Transformation**: Click "Transform" in the context menu or toolbar
3. **Configure Options**:
   - Select target language
   - Select template (if available)
   - Additional options depending on file type
4. **Processing**: Transformation is performed by the Secretary Service
5. **Result**: The transformed Markdown file is saved as a "Shadow Twin"

### Shadow Twins

Transformed files are saved as "Shadow Twins":
- **Storage Location**: Same folder as the original
- **Naming Convention**: `originalname.<language>.md` (e.g., `document.de.md`)
- **Linking**: Shadow Twin is linked to the original
- **Usage**: Shadow Twins can be used for search, RAG, and gallery publishing

### Batch Transformation

Multiple files can be transformed simultaneously:
1. Select multiple files (Ctrl/Shift + Click)
2. Start batch transformation
3. Monitor progress in the Event Monitor

### Monitor Progress

- **Event Monitor**: Open `/event-monitor` to see the status of transformations
- **Job Status**: Jobs can have status `pending`, `processing`, `completed`, or `failed`
- **Error Handling**: Failed jobs can be restarted in the Event Monitor

## Troubleshooting
- Message "Please configure the library in settings.": Check `/settings` → Library and Storage.
- No preview: Check file type; download and open locally if needed.
- Transformation doesn't start: Check Secretary Service configuration (`/settings` → Secretary Service)
- Transformation fails: Check Event Monitor for error messages

