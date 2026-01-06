## Docs Cleanup: Delete list (approved by plan)

This list contains files that are deleted as part of the docs cleanup to reduce noise and outdated variants.
The canonical docs are now in:
- `docs/architecture/*` (design/current architecture)
- `docs/analysis/*` (current runtime behavior and decisions)

### Delete candidates

#### docs/analysis
- `docs/analysis/browser-test-analysis.md` (replaced by `browser-test-analysis-latest.md`)
- `docs/analysis/library-root-loading-analysis.md` (superseded by broader performance analysis)
- `docs/analysis/shadow-twin-processing-status.md` (merged into `docs/analysis/shadow-twin-v2-only.md`)

#### docs/_analysis (historical working notes)
All files below are removed because they are either:
- obsolete implementation plans,
- intermediate debugging notes now captured in canonical docs,
- or no longer relevant to the current code.

Exceptions (kept for now because they are unique reference material):
- `docs/_analysis/SecretaryService API overview.md`
- `docs/_analysis/email-service-provider-examples.md`

Files to delete:
- `docs/_analysis/chat-cache-key-llmmodel.md`
- `docs/_analysis/chat-orchestration-flow.md`
- `docs/_analysis/cleanup-summary.md`
- `docs/_analysis/creation-flow-test-checklist.md`
- `docs/_analysis/creation-shadowtwin-master.md`
- `docs/_analysis/creation-shadowtwin-testing-guide.md`
- `docs/_analysis/creation-wizard-flow-summary.md`
- `docs/_analysis/creation-wizard-implementation-plan.md`
- `docs/_analysis/creation-wizard-presets-analyse.md`
- `docs/_analysis/creation-wizard-testing-guide.md`
- `docs/_analysis/dependencies.md`
- `docs/_analysis/documentation-progress.md`
- `docs/_analysis/documentation-updates-linter-fixes.md`
- `docs/_analysis/example-creation-block-session.md`
- `docs/_analysis/file-inventory.md`
- `docs/_analysis/filesystem-zip-extract-optimization.md`
- `docs/_analysis/frontend-multi-itemtypes.md`
- `docs/_analysis/generic-creation-flow-quick-test.md`
- `docs/_analysis/generic-creation-flow-testing.md`
- `docs/_analysis/homepage-library-visibility-flag.md`
- `docs/_analysis/ingestion-service-refactoring.md`
- `docs/_analysis/integration-tests-phase3-analysis.md`
- `docs/_analysis/item-lifecycle-and-distribution-analysis.md`
- `docs/_analysis/job-monitor-log-spam.md`
- `docs/_analysis/legacy-markdown-adoption-delete-bug.md`
- `docs/_analysis/llm-structured-output-schema-relax-and-normalize.md`
- `docs/_analysis/mongodb-vector-search-ingestion-analysis.md`
- `docs/_analysis/mongodb-vector-search-migration-docs.md`
- `docs/_analysis/multi-source-creation-wizard.md`
- `docs/_analysis/next-step-shadowtwin-v2-2026-01-04.md`
- `docs/_analysis/pdf-transformation-phases-ist.md`
- `docs/_analysis/saveditemid-contract-variant-a-2026-01-04.md`
- `docs/_analysis/shadow-twin-basename-dot-bug.md`
- `docs/_analysis/shadow-twin-centralization-analysis.md`
- `docs/_analysis/shadow-twin-implementation-plan.md`
- `docs/_analysis/shadow-twin-umgehung-zentrale-logik.md`
- `docs/_analysis/shadow-twin-v2-only-legacy-audit-2026-01-04.md`
- `docs/_analysis/storage-fileid-undefined.md`
- `docs/_analysis/story-mode-initial-load-analysis.md`
- `docs/_analysis/terminal-logs-analysis.md`
- `docs/_analysis/transformer.md`
- `docs/_analysis/unified-ingestion-flow.md`
- `docs/_analysis/unused-code-analysis.md`
- `docs/_analysis/unused-components-explore.md`
- `docs/_analysis/wizard-pdf-human-in-loop.md`
- `docs/_analysis/wizard-pdf-shadowtwin-publish-contract.md`
- `docs/_analysis/wizard-single-file-collect-view.md`
- `docs/_analysis/wizard-umstellung-external-jobs.md`

Finally:
- `docs/_analysis/docs-cleanup-inventory.md` (temporary working file)



