# Markdown Page Splitting for PDF Measures

## Context
We need one document per PDF page (each page represents a single measure). The current PDF pipeline already inserts explicit page markers in the transcript markdown (`--- Seite N ---`). These markers are reliable enough for deterministic splitting without re-running OCR.

## Options Considered
- **Split transcript markdown into per-page files, then transform per file.**  
  Low risk and minimal new logic, but requires a per-file transform mode to avoid combined output.
- **Create one external job per page.**  
  Accurate but creates high orchestration overhead.
- **Re-OCR page images.**  
  Expensive and unnecessary because transcript markers already exist.

## Decision
Implement a **page splitter** that turns transcript markdown into `page-XXX.md` files inside a folder named after the source file. Then extend batch transformation with a **per-file mode** so each page gets its own template output.

## Risks & Mitigations
- **Missing or malformed page markers** → return a clear error and avoid partial output.
- **Unsafe folder names** → sanitize source file name to a filesystem-safe folder name.
- **Output collisions** → use deterministic `page-XXX` names and template-specific output names.

## Validation Plan
- Unit test for page splitting using real marker format.
- Manual test: split a PDF transcript and confirm 1 file per page.
- Batch test: per-file transform yields one output document per page.
