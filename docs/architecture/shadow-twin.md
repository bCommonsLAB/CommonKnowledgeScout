# Shadow‑Twin (architecture)

Status: active  
Last verified: 2026-01-06  

> User-facing overview: `docs/guides/shadow-twin.md`

## Scope

This document describes the **intended storage model and contracts** for Shadow‑Twin artifacts in the current system.
It is intentionally focused on **naming, layout, and resolver/writer contracts** (not UI details).

## Glossary

- **Source file**: the original file (PDF/audio/video/image/…).
- **Shadow‑Twin**: derived artifacts (Markdown + assets) stored next to the source.
- **Transcript**: extracted text as Markdown (typically without frontmatter).
- **Transformation**: template-based Markdown with frontmatter/metadata.
- **Dot-folder**: hidden folder `.{originalName}` grouping multiple related artifacts.

## Concept

A **Shadow‑Twin** is the text/metadata representation of an original file (PDF, audio, video, image, …). It may include:
- **Markdown artifacts** (transcript + transformation)
- **Images/assets** (e.g. extracted from PDFs)

Shadow‑Twins exist to enable:
- searchability
- structured metadata
- reliable downstream ingestion / RAG

## User story mapping (how this feels in the UI)

Even for expert users, the mental model is usually **intent-driven**, not file-driven. We therefore describe the pipeline as a 3‑step story:

1. **Text erzeugen** (media-dependent)
   - PDF/Image: OCR/Extract → transcript artifact
   - Audio/Video: Transkription → transcript artifact
2. **Transformieren** (journalistic moment)
   - LLM/template converts raw text into structured, meaningful content → transformation artifact
3. **Veröffentlichen**
   - ingestion into the Library/RAG index → Mongo Vector Search (meta + chunks)

Storage-wise these steps map deterministically to Shadow‑Twin artifacts:
- Step 1 → Transcript `{base}.{lang}.md`
- Step 2 → Transformation `{base}.{template}.{lang}.md`
- Step 3 → Ingestion records keyed by the **source fileId** (index/chunks)

## Storage layout

Shadow‑Twins have a **single canonical write layout** and one legacy read fallback.

### 1) Dot‑folder (canonical)

Hidden folder (starts with `.`), containing all related files:

```
.document.pdf/
├── document.de.md                 (Transcript)
├── document.<template>.de.md      (Transformation)
├── page-001.png                   (Extracted images)
└── ...
```

**Folder naming**: `.{originalName}` (e.g. `.document.pdf/`)  
**Length limit**: 255 characters (truncated if necessary).

### 2) Siblings (legacy read fallback only)

Files stored next to the original (legacy). The system may still resolve these for backwards compatibility,
but **new writes should not create siblings**. A future repair/migration run is expected to move siblings into
the dot-folder and remove them.

```
document.pdf
document.de.md                 (Transcript)
document.<template>.de.md      (Transformation)
```

## Naming conventions (current)

### Transcript artifact
- **Format**: `{baseName}.{language}.md`
- **Example**: `document.de.md`
- **Created**: after Extract/Transcribe
- **Content**: extracted markdown (typically without frontmatter)

### Transformation artifact
- **Format**: `{baseName}.{templateName}.{language}.md`
- **Example**: `document.pdfanalyse.de.md`
- **Created**: after Template transformation
- **Content**: markdown with frontmatter/metadata

### Dot‑folder
- **Format**: `.{originalName}`
- **Example**: `.document.pdf/`

## Resolution model (how the UI finds the “right” artifact)

For library browsing (e.g. `file-list.tsx`) the UI does **not** implement filename heuristics. Instead:

1. UI calls `POST /api/library/[libraryId]/artifacts/batch-resolve` (in batches of ≤100).
2. Server resolves each source via `resolveArtifact()`:
   - checks the dot‑folder first (if present)
   - falls back to siblings
   - if `preferredKind === 'transformation'` and no `templateName` is provided, the resolver selects the best matching transformation for the language (currently: newest by `modifiedAt`)
3. Server returns `ResolvedArtifactWithItem` so the UI does **not** need additional per-item fetches.

Entry points:
- `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts`
- `src/lib/shadow-twin/artifact-resolver.ts`
- `src/lib/shadow-twin/artifact-client.ts`
- `src/hooks/use-shadow-twin-analysis.ts`

## Writing model (how artifacts are stored)

Writing is centralized to avoid duplicates and to enforce deterministic updates:
- `writeArtifact()` uses a canonical filename derived from the artifact key
- if the target file already exists → it is overwritten (update, not duplicate)
- optionally writes into a dot‑folder (when needed for related assets)

Entry point:
- `src/lib/shadow-twin/artifact-writer.ts`

## Code references (current)

- **Naming & parsing**: `src/lib/shadow-twin/artifact-naming.ts`
- **Resolver**: `src/lib/shadow-twin/artifact-resolver.ts`
- **Writer**: `src/lib/shadow-twin/artifact-writer.ts`
- **Bulk API**: `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts`
- **Client wrapper**: `src/lib/shadow-twin/artifact-client.ts`

## Usage examples

### Resolve an artifact (server-side)

```typescript
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver';

const resolved = await resolveArtifact(provider, {
  sourceItemId,
  sourceName: 'document.pdf',
  parentId,
  targetLanguage: 'de',
  preferredKind: 'transformation',
  templateName: 'pdfanalyse',
});
```

### Write an artifact (server-side)

```typescript
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer';

await writeArtifact(provider, {
  key: {
    sourceId: sourceItemId,
    kind: 'transformation',
    targetLanguage: 'de',
    templateName: 'pdfanalyse',
  },
  sourceName: 'document.pdf',
  parentId,
  content: markdownWithFrontmatter,
  createFolder: true,
});
```

## Best practices

1. **UI must not implement filename heuristics**: use the bulk resolver API.
2. **Use centralized naming**: `buildArtifactName()` for canonical filenames.
3. **Use centralized writing**: `writeArtifact()` to enforce update semantics.
4. **Dot‑folder naming must respect the 255 char limit**: rely on `generateShadowTwinFolderName()`.
