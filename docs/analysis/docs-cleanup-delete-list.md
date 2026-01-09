## Docs cleanup: delete list (v2-only focus)

Status: active  
Last verified: 2026-01-06  

### Scope
This document lists the files we delete as part of the docs consolidation.
Rationale and replacement targets are included so the cleanup is auditable.

## Files to delete

| File | Why delete | Replacement |
|---|---|---|
| `docs/mongodb-vector-search-index.md` | Duplicates MongoDB Vector Search index details; also wrong placement (root) and mixed language. | Merged into `docs/architecture/mongodb-vector-search.md` (“Token indexes for filtering”). |
| `docs/_analysis/audio-transcribe-without-template-2026-01-06.md` | Scratch note moved to canonical analysis doc. | `docs/analysis/audio-jobs-transcript-only.md` |
| `docs/_analysis/docs-cleanup-delete-list.md` | Replaced by this canonical delete list in `docs/analysis/`. | `docs/analysis/docs-cleanup-delete-list.md` |
| `docs/_analysis/gallery-table-upsertedat-spalte.md` | Very specific UI change; belongs in issue tracker, not docs canon. | None (keep history in git). |
| `docs/_analysis/email-service-provider-examples.md` | Unrelated to the v2-only pipeline docs scope; mixed language and not maintained. | None (move to product/ops docs later if needed). |
| `docs/_analysis/shadow-twin-migration-and-items.md` | Obsolete “Variante 1” design that contradicts v2-only runtime (moves truth into Mongo). | Canon: `docs/architecture/shadow-twin.md` + `docs/analysis/shadow-twin-v2-only.md` |
| `docs/_chats/cursor_ingestion_flow_strategie_und_red.md` | Chat transcript; not a maintained doc. | None. |
| `docs/template-commoning-umbau.md` | Old draft (DE) in root; not maintained and outside canon. | None (rewrite into `docs/analysis/` later if still needed). |

## Link-fix policy

After deletion:
- remove or replace any internal links to the deleted files
- MkDocs nav must not reference deleted files



