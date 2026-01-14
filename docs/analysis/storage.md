## Storage (current runtime)

Status: active  
Last verified: 2026-01-04  

### Scope
This document explains how storage providers behave in this project and which errors are common.

### Glossary
- **Provider**: a backend adapter (filesystem, OneDrive, ...)
- **itemId**: provider-specific identifier for a file/folder
- **parentId**: folder itemId that contains the item

## Providers
This codebase supports multiple providers (examples):
- local filesystem
- OneDrive (Microsoft Graph)

Provider types live under:
- `src/lib/storage/*`

## Common issue: `fileId=undefined` requests (filesystem)
Symptom:
- after upload, a list request is made with `fileId=undefined`, leading to ENOENT/404.

Root cause (typical):
- caller calls `refreshItems()` without a folder id, so the URL contains `undefined`.

Fix strategy:
- fix the caller to always pass a folder id (or default to `root`)
- optionally harden server parsing to treat `"undefined"|"null"|""` as `root` (safety net)

## Related reference docs
- `docs/reference/modules/storage.md`



