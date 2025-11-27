# Shadow-Twin Architecture

## Concept

A **Shadow-Twin** is a transformed representation of an original document (PDF, audio, video, image, text) stored alongside the original. It contains:

- **Markdown files**: Extracted text, structured content, and metadata
- **Images**: Extracted images from PDFs or OCR results
- **Media files**: Audio/video transcripts

Shadow-Twins enable:
- Searchable text content
- Structured metadata
- RAG (Retrieval Augmented Generation) integration
- Media-independent processing pipeline

## Structure

Shadow-Twins can exist in two forms:

### 1. Shadow-Twin Directory (when images/media are present)

A hidden directory (starts with `.`) containing all related files:

```
.document.pdf/
├── document.md          (Transcript - Phase 1 output)
├── document.de.md       (Transformed - Phase 2 output)
├── page-001.png        (Extracted images)
├── page-002.png
└── ...
```

**When created**: Automatically when images are extracted (`includeOcrImages` or `includePageImages` enabled)

**Directory naming**: `.{originalName}` (e.g., `.document.pdf/`)
- Maximum length: 255 characters (truncated if necessary)
- Hidden from normal directory listings (starts with `.`)

### 2. Shadow-Twin Files (when no images/media)

Files stored directly next to the original:

```
document.pdf
document.md          (Transcript - Phase 1 output)
document.de.md       (Transformed - Phase 2 output)
```

## Naming Conventions

### Transcript File

- **Format**: `{originalName}.md`
- **Example**: `document.md`
- **Created**: After Phase 1 (Extract)
- **Content**: Extracted text without frontmatter
- **Language**: **No language suffix** (original language of source)

### Transformed File

- **Format**: `{originalName}.{language}.md`
- **Example**: `document.de.md`
- **Created**: After Phase 2 (Template)
- **Content**: Text with frontmatter and metadata
- **Language**: **With language suffix** (target language for transformation)

### Shadow-Twin Directory

- **Format**: `.{originalName}`
- **Example**: `.document.pdf/`
- **Created**: When images are extracted
- **Length limit**: 255 characters (truncated if necessary)

## State Management

### Job Document (Primary Source)

Shadow-Twin state is calculated at job start, updated by the processing phases, and stored in MongoDB:

```typescript
interface ExternalJob {
  shadowTwinState?: {
    baseItem: { id: string; metadata: { name: string } };
    transformed?: { id: string; metadata: { name: string } };
    transcriptFiles?: Array<{ id: string; metadata: { name: string } }>;
    shadowTwinFolderId?: string;
    mediaFiles?: Array<{ id: string; metadata: { name: string } }>;
    analysisTimestamp: number;
    analysisError?: string;
    processingStatus?: 'processing' | 'ready' | 'error' | null;
  };
}
```

**Benefits**:
- Single source of truth
- Available to all workers (parallel processing)
- Persistent across sessions

### Frontend Atom (UI Display)

Frontend uses Jotai atom for UI state:

```typescript
const shadowTwinStateAtom = atom<Map<string, FrontendShadowTwinState>>(new Map());
```

**Purpose**: UI display only (not primary source)
**Updates**: From job documents or local analysis

## Analysis Logic

Shadow-Twin analysis is performed by `analyzeShadowTwin()`:

1. **Load base item** (original file)
2. **Check for Shadow-Twin directory**:
   - Search for `.document.pdf/` directory
   - If found: Load contents
3. **Check for Shadow-Twin files**:
   - Search for `document.md` (transcript)
   - Search for `document.de.md` (transformed)
4. **Classify files**:
   - Files without language suffix → `transcriptFiles`
   - Files with language suffix → `transformed` (after frontmatter check)
5. **Return ShadowTwinState**

## File Types in Shadow-Twin

### `transcriptFiles`

- **Type**: `StorageItem[]`
- **Content**: Markdown without frontmatter
- **Naming**: `{originalName}.md` (no language suffix)
- **Created**: Phase 1 (Extract)
- **Purpose**: Raw extracted text (original language)

### `transformed`

- **Type**: `StorageItem`
- **Content**: Markdown with frontmatter
- **Naming**: `{originalName}.{language}.md` (with language suffix)
- **Created**: Phase 2 (Template)
- **Purpose**: Structured document with metadata

### `shadowTwinFolderId`

- **Type**: `string | undefined`
- **Content**: ID of Shadow-Twin directory
- **Created**: When images are extracted
- **Purpose**: Container for all Shadow-Twin files

### `mediaFiles`

- **Type**: `StorageItem[]`
- **Content**: Audio/video files
- **Purpose**: Original media files (for audio/video transformations)

## Code References

### Core Functions

- **`src/lib/storage/shadow-twin.ts`**:
  - `generateShadowTwinName()`: Generate file names (with/without language suffix)
  - `generateShadowTwinFolderName()`: Generate directory names
  - `findShadowTwinFolder()`: Find Shadow-Twin directory
  - `findShadowTwinMarkdown()`: Find Markdown files (both variants)

- **`src/lib/shadow-twin/analyze-shadow-twin.ts`**:
  - `analyzeShadowTwin()`: Analyze file and find all Shadow-Twin components

- **`src/lib/shadow-twin/shared.ts`**:
  - `ShadowTwinState`: Shared type definition
  - `toMongoShadowTwinState()`: Convert to MongoDB-compatible format

### State Management

- **`src/atoms/shadow-twin-atom.ts`**:
  - `shadowTwinStateAtom`: Frontend state atom
  - `FrontendShadowTwinState`: Frontend type (with full StorageItem objects)

- **`src/hooks/use-shadow-twin-analysis.ts`**:
  - `useShadowTwinAnalysis()`: React hook for automatic analysis

### Processing

- **`src/lib/external-jobs/extract-only.ts`**:
  - Extract phase: Creates transcript file (`document.md`)

- **`src/lib/external-jobs/storage.ts`**:
  - `saveMarkdown()`: Saves Markdown files (transcript or transformed)

- **`src/lib/processing/gates.ts`**:
  - `gateExtractPdf()`: Checks if extraction should be skipped
  - `gateTransformTemplate()`: Checks if template phase should be skipped

## Usage Examples

### Finding a Shadow-Twin

```typescript
import { findShadowTwinFolder, findShadowTwinMarkdown } from '@/lib/storage/shadow-twin';

// Find directory
const folder = await findShadowTwinFolder(parentId, 'document.pdf', provider);

// Find Markdown (prefers transformed, falls back to transcript)
const markdown = await findShadowTwinMarkdown(folder.id, 'document', 'de', provider);
```

### Creating or Finding Shadow-Twin Folder

```typescript
import { findOrCreateShadowTwinFolder } from '@/lib/external-jobs/shadow-twin-helpers';

// Find existing folder or create new one
// Returns folder ID (string) or undefined if failed
const folderId = await findOrCreateShadowTwinFolder(
  provider,
  parentId,
  'document', // original name without extension
  jobId
);

if (folderId) {
  // Use folderId to save files in Shadow-Twin directory
  await provider.saveFile(folderId, 'document.md', content);
}
```

### Analyzing Shadow-Twin State

```typescript
import { analyzeShadowTwin } from '@/lib/shadow-twin/analyze-shadow-twin';

const state = await analyzeShadowTwin(fileId, provider);
if (state) {
  console.log('Transcript:', state.transcriptFiles);
  console.log('Transformed:', state.transformed);
  console.log('Folder:', state.shadowTwinFolderId);
}
```

## Best Practices

1. **Always use job document state** as primary source (not frontend atom)
2. **Check both file variants** when searching (transcript and transformed)
3. **Respect naming conventions** (transcript without language, transformed with language)
4. **Handle directory length limits** (255 characters)
5. **Use analysis function** instead of manual file searching


