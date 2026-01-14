---
status: active
last_verified: 2026-01-06
---

# Docs Cleanup Inventory (v2-only focus)

This document is the **working inventory** for consolidating documentation into a small set of canonical docs.

## Scope

- **In scope**: `docs/architecture/`, `docs/analysis/`, `docs/_analysis/` (+ a few root docs that clearly duplicate canon).
- **Out of scope**: `docs/reference/` and `docs/use-cases/` content correctness (we only classify them).

## Rules used for classification

- **keep**: required and correct today, or actively linked from MkDocs nav.
- **merge**: contains valuable content but is duplicated / in the wrong location / wrong language.
- **delete**: scratch, obsolete, or contradicts v2-only runtime.

## Inventory table

| File | Topic | Status | Target / Notes |
|---|---|---:|---|
| `docs/index.md` | Docs entrypoint | keep | Canonical start page (MkDocs “Home”). |
| `docs/architecture/shadow-twin.md` | Shadow‑Twin (design) | keep | Canonical design doc (add standard header + glossary). |
| `docs/analysis/shadow-twin-v2-only.md` | Shadow‑Twin (runtime) | keep | Canonical runtime/decision doc. |
| `docs/guides/shadow-twin.md` | Shadow‑Twin (user guide) | keep | Keep as user-facing companion; not in MkDocs nav (optional add later). |
| `docs/analysis/wizard-and-jobs.md` | External Jobs / Wizard (runtime) | keep | Canonical runtime/contract doc. |
| `docs/architecture/pdf-transformation-phases.md` | PDF pipeline (design + IST) | keep | Canonical pipeline doc (needs naming section aligned with v2-only conventions). |
| `docs/analysis/ingestion.md` | Ingestion (runtime) | keep | Canonical operational ingestion doc. |
| `docs/architecture/mongodb-vector-search.md` | MongoDB Vector Search (design) | keep | Canonical architecture doc. |
| `docs/analysis/storage.md` | Storage (runtime) | keep | Canonical operational storage doc. |
| `docs/architecture/module-hierarchy.md` | Architecture overview | keep | In MkDocs nav. |
| `docs/architecture/dependency-graph.md` | Architecture overview | keep | In MkDocs nav. |
| `docs/reference/file-index.md` | Reference | keep | In MkDocs nav. |
| `docs/reference/modules/library.md` | Reference | keep | In MkDocs nav. |
| `docs/reference/modules/storage.md` | Reference | keep | In MkDocs nav. |
| `docs/reference/modules/chat.md` | Reference | keep | In MkDocs nav. |
| `docs/use-cases/index.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/library-setup.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/file-transformation-pdf.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/file-transformation-media.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/web-scraping.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/publishing.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/chat-exploration.md` | Use cases | keep | In MkDocs nav. |
| `docs/use-cases/batch-operations.md` | Use cases | keep | In MkDocs nav. |
| `docs/analysis/performance-analysis-loading.md` | Performance | keep | Keep; consider moving into a dedicated “Performance” section later. |
| `docs/analysis/browser-test-analysis-latest.md` | QA / Browser tests | keep | Keep; consider moving into a dedicated “QA” section later. |
| `docs/architecture/template-system.md` | Templates | merge | Draft (DE). Either rewrite to English + standard header or move to scratch and keep out of nav. |
| `docs/architecture/secretary-format-interfaces.md` | Secretary formats | keep | Keep (not in nav). Consider moving under `docs/reference/api/` later. |
| `docs/_secretary-service-docu/overview.md` | Secretary API docs | keep | Keep (not in nav). Consider moving to `docs/reference/api/`. |
| `docs/_secretary-service-docu/pdf.md` | Secretary API docs | keep | Keep (not in nav). |
| `docs/_secretary-service-docu/audio.md` | Secretary API docs | keep | Keep (not in nav). |
| `docs/_secretary-service-docu/transformer.md` | Secretary API docs | keep | Keep (not in nav). |
| `docs/mongodb-vector-search-index.md` | MongoDB Vector Search | merge | Merge “token index” details into `docs/architecture/mongodb-vector-search.md`, then delete. |
| `docs/mongodb-indexes.md` | MongoDB indexes | merge | Move under `docs/reference/` (or keep as root but not canonical). |
| `docs/github-branch-protection-setup.md` | Repo ops | merge | Move to `docs/ops/` (or keep as root but not canonical). |
| `docs/template-commoning-umbau.md` | Template redesign | delete | Old draft (DE) in root; keep history in git. If still needed, rewrite as English and put into `docs/analysis/`. |
| `docs/architecture/artifact-pipeline-v3-design.md` | Artifact pipeline | keep | Keep (not in nav). |
| `docs/architecture/requirements-artifact-pipeline-v3.md` | Artifact pipeline | keep | Keep (not in nav). |
| `docs/architecture/use-cases-and-personas.md` | Personas | keep | Keep (not in nav). |
| `docs/_analysis/audio-transcribe-without-template-2026-01-06.md` | External Jobs (audio) | merge | Promote to `docs/analysis/` as validated decision (English), then delete from `_analysis`. |
| `docs/_analysis/gallery-table-upsertedat-spalte.md` | Gallery UI | delete | Very specific UI task; belongs in issue tracker, not canonical docs. |
| `docs/_analysis/email-service-provider-examples.md` | Email service | delete | Unrelated to v2-only pipeline; move to product/ops docs if needed. |
| `docs/_analysis/shadow-twin-migration-and-items.md` | Shadow‑Twin migration | delete | Contradicts v2-only runtime (moves truth into Mongo); keep history in git. |
| `docs/_analysis/docs-cleanup-delete-list.md` | Docs cleanup | delete | Will be replaced by `docs/analysis/docs-cleanup-delete-list.md`. |
| `docs/_chats/cursor_ingestion_flow_strategie_und_red.md` | Chat transcript | delete | Scratch; remove from repo docs tree. |

## Next steps

1. Update the canonical docs to a consistent header format (status, last verified, scope, glossary, code links).
2. Produce a delete list + merge plan (with replacements) in `docs/analysis/docs-cleanup-delete-list.md`.
3. Apply deletes and fix internal links.



