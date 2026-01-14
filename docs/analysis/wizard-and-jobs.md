## Wizard & External Jobs (current runtime)

Status: active  
Last verified: 2026-01-04  

### Scope
This document explains the **current** PDF wizard and external-jobs pipeline behavior.
It focuses on the runtime contracts that must hold (so the UI does not need “fixups”).

### Glossary
- **External Job**: a server-side job document orchestrated by worker + routes.
- **Start route**: `POST /api/external/jobs/[jobId]/start`
- **Callback route**: `POST /api/external/jobs/[jobId]` (webhook receiver)
- **Extract-only**: job runs extraction/transcript creation only.
- **Template-only**: job runs template transformation only (metadata/frontmatter).
- **Publish (Wizard)**: human confirms and we write final frontmatter + ingestion.

### Why this exists (key principle)
The UI must stay simple. It must not repair/guess results.
So we enforce correctness **centrally** in server code and test it end-to-end.

## Pipeline overview (PDF)

High level:
- Worker triggers the start route.
- Start route decides which phases to run via gates + policies.
- Secretary Service does OCR/template and calls back.
- Callback route orchestrates the remaining phases and stores artifacts.

Canonical architecture reference:
- `docs/architecture/pdf-transformation-phases.md`

## Contracts (must always hold)

### Contract 1: completed => result.savedItemId exists
If a job is `completed`, it must already have a persisted `result.savedItemId`.
Otherwise polling clients can see `completed` with empty `result` (race condition).

### Contract 2: savedItemId points to the correct artifact kind
Stronger rule:
- **Template enabled** => `savedItemId` must point to the **transformation** artifact (with frontmatter).
- **Extract-only** => `savedItemId` must point to the **transcript** artifact.

This is critical because transcript files typically do not have frontmatter.
If `savedItemId` points to a transcript in a template job, the wizard preview and metadata will appear empty.

Enforcement location:
- `src/lib/external-jobs/complete.ts` (central contract enforcement)

## PDFAnalyse “publish contract” (no extra final markdown)

Goal:
- The canonical published document is the **transformation markdown inside the Shadow-Twin**:
  - `.{PDF-Name}/{PDF-Stem}.pdfanalyse.{lang}.md`

Publish behavior:
- Wizard overwrites **that** transformation file’s **frontmatter** (body stays from transformation).
- Wizard triggers ingestion (RAG) for that same file.
- The wizard must **not** create an additional “final” markdown outside the Shadow-Twin.

## Testing strategy (how we catch regressions)
- Integration test validators assert:
  - completed jobs have `result.savedItemId`
  - `savedItemId` matches expected artifact kind for the job type
  - template name matches when template jobs are configured

Key files:
- `src/lib/integration-tests/validators.ts`
- `src/lib/integration-tests/test-cases.ts`
- `src/lib/integration-tests/orchestrator.ts`



