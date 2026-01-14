## Shadow-Twin (v2-only runtime)

Status: active  
Last verified: 2026-01-04  

### Scope
This document describes **how Shadow-Twin works in the current runtime** (v2-only).  
It does **not** describe migration/repair of old data (Phase B, deferred).

### Summary (what is true today)
- The application runtime is **v2-only** for Shadow-Twin artifact resolve/write.
- Transcript + Transformation artifacts use **deterministic names**.
- The UI must not guess filenames. It uses the backend resolver (bulk).
- Legacy/V1 repair paths were removed from the runtime path.

### Glossary
- **Artifact**: a generated file related to a source file (Markdown, images).
- **Transcript**: extracted text (usually without frontmatter).
- **Transformation**: template-based Markdown with frontmatter/metadata.
- **Dot-folder**: hidden folder `.{originalName}` that groups multiple related artifacts.

### v2-only enforcement
We treat any “legacy/v1 Shadow-Twin logic” as unsupported in runtime.

- Config may still contain `shadowTwin.mode = legacy|v2` for historical libraries.
- The runtime does **not** execute legacy heuristics or legacy adoption/cleanup.
- UI/Settings provides a safe action: set the config flag to **v2** (no migration).

### Artifact locations (storage)
Artifacts can live either:
1) inside a **dot-folder** `.{originalName}/` (recommended when multiple assets exist), or  
2) as **siblings** next to the source file (common for “only Markdown” cases).

The resolver checks dot-folder first (if present), then siblings.

### Naming (v2)
Transcript:
- `{baseName}.{language}.md`
- Example: `document.de.md`

Transformation:
- `{baseName}.{templateName}.{language}.md`
- Example: `document.pdfanalyse.de.md`

### Central entry points (code)
Resolve:
- `src/lib/shadow-twin/artifact-resolver.ts` (`resolveArtifact`)
- `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts`

Write:
- `src/lib/shadow-twin/artifact-writer.ts` (`writeArtifact`)
- Used by external jobs and creation flows

### Known fixed issue: processingStatus in extract-only
Observed issue: `shadowTwinState.processingStatus` could end up missing for extract-only jobs.  
Current behavior: after transcript is saved, extract-only recomputes the Shadow-Twin state and writes `processingStatus = 'ready'`, plus a final idempotent fallback at job end.

Implementation reference:
- `src/lib/external-jobs/extract-only.ts`



