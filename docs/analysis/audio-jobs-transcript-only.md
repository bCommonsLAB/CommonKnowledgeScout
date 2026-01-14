## Audio/Video jobs without template: transcript-only (runtime decision)

Status: active  
Last verified: 2026-01-06  

### Scope
This document captures the runtime contract for **audio/video transcription** when the user does **not** select a template.
It focuses on preventing accidental template runs and “template not found” failures.

### Glossary
- **Transcript-only**: job writes a transcript Markdown and stops (no template, no ingest)
- **Template phase**: metadata/frontmatter transformation using a template
- **Ingest phase**: RAG ingestion into MongoDB Vector Search

## Problem
Users can start audio/video transcription **without selecting a template**.
In that case, the expected behavior is:

- produce the transcript Markdown (Shadow‑Twin transcript artifact)
- do **not** run template transformation
- do **not** run ingestion
- finish successfully with a meaningful `result.savedItemId`

## Decision (contract)

**If `template` is missing/empty, audio/video jobs must behave as transcript-only.**

That implies:
- `policies.metadata = 'ignore'`
- `policies.ingest = 'ignore'`
- final output is the **transcript artifact**, and `result.savedItemId` must point to that transcript file

## Why
- It matches explicit user intent (“no template”).
- It avoids implicit defaults and prevents `template_not_found` failures.
- It keeps the job semantics deterministic and easy to reason about.

## Implementation notes (where this must be enforced)
- Start routes must not introduce a default template when the client did not select one.
- Callback completion must treat “completed transcription payload” as final and persist `savedItemId`.

Relevant code areas (non-exhaustive):
- `src/app/api/secretary/process-audio/job/route.ts`
- `src/app/api/secretary/process-video/job/route.ts`
- `src/lib/external-jobs/progress.ts`
- `src/app/api/external/jobs/[jobId]/route.ts`



