# File Inventory

This document provides a complete inventory of all source files in the `src/` directory, categorized by type and purpose.

**Total Files**: ~424 files (233 .ts files + 191 .tsx files)

## Entry Points

| File Path | Type | Description |
|-----------|------|-------------|
| `src/middleware.ts` | Middleware | Authentication and routing middleware |
| `src/app/layout.tsx` | Layout | Root layout component |
| `src/instrumentation.ts` | Instrumentation | Next.js instrumentation |

## API Routes

### Authentication
- `src/app/api/auth/onedrive/callback/route.ts`
- `src/app/api/auth/onedrive/refresh/route.ts`
- `src/app/api/auth-test/route.ts`

### Chat API (`src/app/api/chat/[libraryId]/`)
- `adhoc/route.ts` - Ad-hoc chat operations
- `analyze-chapters/route.ts` - Chapter analysis
- `chats/[chatId]/route.ts` - Individual chat operations
- `chats/route.ts` - Chat list operations
- `config/route.ts` - Chat configuration
- `doc-meta/route.ts` - Document metadata
- `docs/route.ts` - Document operations
- `document-status/route.ts` - Document status check
- `facets/route.ts` - Facet operations
- `file-status/route.ts` - File status check
- `index/route.ts` - Index operations
- `index-status/route.ts` - Index status check
- `ingest/route.ts` - Ingestion operations
- `ingestion-status/route.ts` - Ingestion status
- `ingest-markdown/route.ts` - Markdown ingestion
- `queries/[queryId]/explain/route.ts` - Query explanation
- `queries/[queryId]/route.ts` - Individual query operations
- `queries/route.ts` - Query list operations
- `route.ts` - Main chat route
- `stats/route.ts` - Chat statistics
- `stream/route.ts` - Chat streaming endpoint
- `toc-cache/route.ts` - Table of contents cache
- `upsert-doc-meta/route.ts` - Upsert document metadata
- `upsert-file/route.ts` - Upsert file

### Event Jobs (`src/app/api/event-job/`)
- `batches/[batchId]/archive/route.ts`
- `batches/[batchId]/archive-status/route.ts`
- `batches/[batchId]/change-language/route.ts`
- `batches/[batchId]/jobs/route.ts`
- `batches/[batchId]/restart/route.ts`
- `batches/[batchId]/route.ts`
- `batches/[batchId]/toggle-active/route.ts`
- `batches/change-language-all/route.ts`
- `batches/fail-all/route.ts`
- `batches/pending-all/route.ts`
- `batches/reset-all/route.ts`
- `batches/route.ts`
- `events/[eventName]/restart-all-batches/route.ts`
- `events/route.ts`
- `jobs/[jobId]/download-archive/route.ts`
- `jobs/[jobId]/process-direct/route.ts`
- `jobs/[jobId]/restart/route.ts`
- `jobs/[jobId]/route.ts`

### External Jobs (`src/app/api/external/jobs/`)
- `[jobId]/download-archive/route.ts`
- `[jobId]/markdown/route.ts`
- `[jobId]/route.ts`
- `[jobId]/start/route.ts`
- `[jobId]/trace/route.ts`
- `batches/route.ts`
- `counters/route.ts`
- `internal/create/route.ts`
- `retry-batch/route.ts`
- `route.ts`
- `start-batch/route.ts`
- `stream/route.ts`
- `worker/route.ts`

### Libraries (`src/app/api/libraries/`)
- `[id]/public/check-slug/route.ts`
- `[id]/public/route.ts`
- `[id]/route.ts`
- `[id]/tokens/route.ts`
- `route.ts`

### Public API (`src/app/api/public/`)
- `libraries/[slug]/route.ts`
- `libraries/route.ts`

### Secretary (`src/app/api/secretary/`)
- `import-from-url/route.ts`
- `process-audio/route.ts`
- `process-image/route.ts`
- `process-pdf/batch/route.ts`
- `process-pdf/route.ts`
- `process-text/route.ts`
- `process-video/route.ts`
- `session/process/route.ts`
- `tracks/[...track]/route.ts`

### Sessions (`src/app/api/sessions/`)
- `[id]/route.ts`
- `events/route.ts`
- `generate-jobs/route.ts`
- `route.ts`
- `transcript/route.ts`

### Storage (`src/app/api/storage/`)
- `filesystem/route.ts`
- `filesystem/upload-archive/route.ts`
- `route.ts`

### Other API Routes
- `src/app/api/add-library/route.ts`
- `src/app/api/db-test/route.ts`
- `src/app/api/debug-libraries/route.ts`
- `src/app/api/env-test/route.ts`
- `src/app/api/health/pinecone/route.ts`
- `src/app/api/metadata/template/run/route.ts`
- `src/app/api/settings/oauth-defaults/route.ts`
- `src/app/api/settings/storage-test/route.ts`
- `src/app/api/test-route/route.ts`
- `src/app/api/teststorage/route.ts`
- `src/app/api/user/route.ts`
- `src/app/api/user-info/route.ts`
- `src/app/api/video/resolve/route.ts`
- `src/app/api/video/transcript/route.ts`

## Pages (`src/app/`)

### Main Pages
- `src/app/page.tsx` - Home page
- `src/app/library/page.tsx` - Library main page
- `src/app/library/chat/page.tsx` - Chat page
- `src/app/library/chat/client.tsx` - Chat client component
- `src/app/library/gallery/page.tsx` - Gallery page
- `src/app/library/gallery/client.tsx` - Gallery client component
- `src/app/library/gallery/ensure-library.tsx` - Library ensure component

### Settings Pages (`src/app/settings/`)
- `appearance/page.tsx`
- `chat/page.tsx`
- `display/page.tsx`
- `layout.tsx`
- `library/page.tsx`
- `notifications/page.tsx`
- `owner/page.tsx`
- `page.tsx`
- `public/page.tsx`
- `secretary-service/page.tsx`
- `settings-client.tsx`
- `storage/page.tsx`

### Other Pages
- `src/app/add-test-library/page.tsx`
- `src/app/datenschutz/page.tsx`
- `src/app/event-monitor/page.tsx`
- `src/app/event-monitor/batches/[batchId]/page.tsx`
- `src/app/event-monitor/jobs/[jobId]/page.tsx`
- `src/app/explore/[slug]/page.tsx`
- `src/app/impressum/page.tsx`
- `src/app/rechtliche-hinweise/page.tsx`
- `src/app/session-manager/page.tsx`
- `src/app/templates/page.tsx`
- `src/app/ueber/page.tsx`

### Error Pages
- `src/app/global-error.tsx`
- `src/app/not-found.tsx`

### Other App Files
- `src/app/auth/microsoft/callback/route.ts`
- `src/app/pdf.worker.mjs/route.ts`

## Components (`src/components/`)

### Library Components (`src/components/library/`)
- `audio-player.tsx`
- `audio-recorder-client.tsx`
- `audio-transform.tsx`
- `book-detail.tsx`
- `breadcrumb.tsx`
- `chapter-accordion.tsx`
- `combined-chat-dialog.tsx`
- `document-preview.tsx`
- `event-details-accordion.tsx`
- `file-category-filter.tsx`
- `file-list.tsx`
- `file-preview.tsx`
- `file-tree.tsx`
- `filter-context-bar.tsx`
- `image-preview.tsx`
- `image-transform.tsx`
- `ingestion-book-detail.tsx`
- `ingestion-dialog.tsx`
- `ingestion-session-detail.tsx`
- `ingestion-status.tsx`
- `job-report-tab.tsx`
- `library.tsx` - Main library component
- `library-header.tsx`
- `library-switcher.tsx`
- `markdown-audio.tsx`
- `markdown-metadata.tsx`
- `markdown-preview.tsx`
- `pdf-bulk-import-dialog.tsx`
- `pdf-canvas-viewer.tsx`
- `pdf-phase-settings.tsx`
- `pdf-phases-view.tsx`
- `pdf-transform.tsx`
- `phase-stepper.tsx`
- `session-detail.tsx`
- `slide-accordion.tsx`
- `template-management.tsx`
- `text-editor.tsx`
- `transcription-dialog.tsx`
- `transformation-dialog.tsx`
- `transform-result-handler.tsx`
- `transform-save-options.tsx`
- `types.tsx`
- `upload-area.tsx`
- `upload-dialog.tsx`
- `video-player.tsx`
- `video-transform.tsx`

### Library Chat Components (`src/components/library/chat/`)
- `chat-config-bar.tsx`
- `chat-config-display.tsx`
- `chat-config-popover.tsx`
- `chat-conversation-item.tsx`
- `chat-document-sources.tsx`
- `chat-input.tsx`
- `chat-message.tsx`
- `chat-messages-list.tsx`
- `chat-panel.tsx`
- `chat-reference-list.tsx`
- `chat-selector.tsx`
- `chat-suggested-questions.tsx`
- `chat-welcome-assistant.tsx`
- `debug-panel.tsx`
- `debug-step-table.tsx`
- `debug-timeline.tsx`
- `debug-trace.tsx`
- `processing-logs-dialog.tsx`
- `processing-status.tsx`
- `query-details-dialog.tsx`
- `hooks/use-chat-scroll.ts`
- `utils/chat-storage.ts`
- `utils/chat-utils.ts`

### Library Story Components (`src/components/library/story/`)
- `story-header.tsx`
- `story-mode-header.tsx`
- `story-topics.tsx`

### Settings Components (`src/components/settings/`)
- `appearance-form.tsx`
- `chat-form.tsx`
- `display-form.tsx`
- `FacetDefsEditor.tsx`
- `library-form.tsx`
- `notifications-form.tsx`
- `owner-form.tsx`
- `public-form.tsx`
- `secretary-service-form.tsx`
- `sidebar-nav.tsx`
- `storage-form.tsx`

### Event Monitor Components (`src/components/event-monitor/`)
- `batch-archive-dialog.tsx`
- `batch-list.tsx`
- `batch-process-dialog.tsx`
- `event-filter-dropdown.tsx`
- `job-archive-test.tsx`
- `job-details-panel.tsx`

### Home Components (`src/components/home/`)
- `conditional-footer.tsx`
- `cta-section.tsx`
- `footer.tsx`
- `hero-section.tsx`
- `how-it-works.tsx`
- `library-grid.tsx`
- `philosophy-section.tsx`

### Shared Components (`src/components/shared/`)
- `ai-generated-notice.tsx`
- `chat-panel.tsx`
- `job-monitor-panel.tsx`
- `job-trace.tsx`
- `key-value-table.tsx`
- `language-switcher.tsx`
- `storage-auth-button.tsx`
- `trace-viewer.tsx`

### UI Components (`src/components/ui/`)
- `accordion.tsx`
- `alert.tsx`
- `alert-dialog.tsx`
- `avatar.tsx`
- `badge.tsx`
- `button.tsx`
- `calendar.tsx`
- `card.tsx`
- `chart.tsx`
- `checkbox.tsx`
- `collapsible.tsx`
- `command.tsx`
- `context-menu.tsx`
- `dialog.tsx`
- `dropdown-menu.tsx`
- `form.tsx`
- `hover-card.tsx`
- `input.tsx`
- `label.tsx`
- `menubar.tsx`
- `popover.tsx`
- `progress.tsx`
- `radio-group.tsx`
- `resizable.tsx`
- `scroll-area.tsx`
- `select.tsx`
- `separator.tsx`
- `sheet.tsx`
- `skeleton.tsx`
- `slider.tsx`
- `switch.tsx`
- `table.tsx`
- `tabs.tsx`
- `textarea.tsx`
- `toast.tsx`
- `toaster.tsx`
- `tooltip.tsx`
- `tree.tsx`
- `use-toast.ts`

### Other Components
- `src/components/debug/debug-footer.tsx`
- `src/components/debug/debug-footer-client.tsx`
- `src/components/debug/debug-footer-wrapper.tsx`
- `src/components/event-slides.tsx`
- `src/components/event-summary.tsx`
- `src/components/icons.tsx`
- `src/components/layouts/app-layout.tsx`
- `src/components/layouts/home-layout.tsx`
- `src/components/login-button.tsx`
- `src/components/session/session-event-filter.tsx`
- `src/components/session/session-import-modal.tsx`
- `src/components/templates/structured-template-editor.tsx`
- `src/components/templates/template-management.tsx`
- `src/components/theme-provider.tsx`
- `src/components/top-nav.tsx`
- `src/components/top-nav-wrapper.tsx`

## Library Code (`src/lib/`)

### Storage (`src/lib/storage/`)
- `filesystem-client.ts`
- `filesystem-provider.ts`
- `onedrive-provider.ts`
- `onedrive-provider-server.ts`
- `server-provider.ts`
- `shadow-twin.ts`
- `storage-factory.ts`
- `storage-factory-mongodb.ts`
- `storage-service.ts`
- `supported-types.ts`
- `types.ts`

### Chat (`src/lib/chat/`)
- `config.ts`
- `constants.ts`
- `debug-stats.ts`
- `dynamic-facets.ts`
- `embeddings.ts`
- `facets.ts`
- `ingestion-service.ts`
- `loader.ts`
- `orchestrator.ts`
- `pinecone.ts`
- `vector-stats.ts`
- `common/budget.ts`
- `common/filters.ts`
- `common/llm.ts`
- `common/prompt.ts`
- `common/question-analyzer.ts`
- `common/toc-parser.ts`
- `retrievers/chunks.ts`
- `retrievers/metadata-extractor.ts`
- `retrievers/summaries-mongo.ts`

### External Jobs (`src/lib/external-jobs/`)
- `auth.ts`
- `chapters.ts`
- `complete.ts`
- `context.ts`
- `images.ts`
- `ingest.ts`
- `policies.ts`
- `preprocess.ts`
- `progress.ts`
- `provider.ts`
- `storage.ts`
- `template-decision.ts`
- `template-files.ts`
- `template-run.ts`

### Secretary (`src/lib/secretary/`)
- `adapter.ts`
- `client.ts`
- `constants.ts`
- `response-parser.ts`
- `types.ts`

### Database (`src/lib/db/`)
- `chats-repo.ts`
- `queries-repo.ts`

### Services (`src/lib/services/`)
- `azure-storage-service.ts`
- `library-service.ts`

### Session (`src/lib/session/`)
- `session-processor.ts`
- `session-utils.ts`

### Transform (`src/lib/transform/`)
- `batch-transform-service.ts`
- `image-extraction-service.ts`
- `transform-service.ts`

### Other Library Files
- `src/lib/atoms/library.ts`
- `src/lib/auth.ts`
- `src/lib/config/azure-storage.ts`
- `src/lib/debug/logger.ts`
- `src/lib/debug/wdyr.ts`
- `src/lib/env.ts`
- `src/lib/event-job-repository.ts`
- `src/lib/events/job-event-bus.ts`
- `src/lib/external-jobs-log-buffer.ts`
- `src/lib/external-jobs-repository.ts`
- `src/lib/external-jobs-watchdog.ts`
- `src/lib/external-jobs-worker.ts`
- `src/lib/i18n/hooks.ts`
- `src/lib/i18n/index.ts`
- `src/lib/i18n/server.ts`
- `src/lib/i18n/types.ts`
- `src/lib/ingestion/page-split.ts`
- `src/lib/library/favorites.ts`
- `src/lib/logging/query-logger.ts`
- `src/lib/markdown/compose.ts`
- `src/lib/markdown/frontmatter.ts`
- `src/lib/mongodb-service.ts`
- `src/lib/pdf-defaults.ts`
- `src/lib/pdfjs-worker-setup.ts`
- `src/lib/processing/gates.ts`
- `src/lib/processing/phase-policy.ts`
- `src/lib/repositories/doc-meta-repo.ts`
- `src/lib/session-repository.ts`
- `src/lib/templates/placeholders.ts`
- `src/lib/test-env.ts`
- `src/lib/text/chunk.ts`
- `src/lib/utils.ts`
- `src/lib/utils/fetch-with-timeout.ts`

## Types (`src/types/`)

- `chat.ts`
- `chat-processing.ts`
- `chat-response.ts`
- `doc-meta.ts`
- `event-job.ts`
- `external-job.ts`
- `external-jobs.ts`
- `library.ts`
- `query-log.ts`
- `retriever.ts`
- `session.ts`
- `story-topics.ts`
- Type definitions: `@welldone-software__why-did-you-render.d.ts`, `better-sqlite3.d.ts`, `pdfjs-dist.d.ts`, `react-volume-meter.d.ts`

## Hooks (`src/hooks/`)

- `use-folder-navigation.ts`
- `use-selected-file.ts`
- `use-storage-provider.tsx`
- `use-story-context.ts`
- `use-toast.ts`
- `use-transcription-twins.ts`

## Atoms (`src/atoms/`)

- `chat-references-atom.ts`
- `combined-chat-atom.ts`
- `create-library-atom.ts`
- `debug-atom.ts`
- `event-filter-atom.ts`
- `gallery-filters.ts`
- `job-status.ts`
- `library-atom.ts`
- `pdf-defaults.ts`
- `pdf-phases.ts`
- `pdf-viewer.ts`
- `story-context-atom.ts`
- `template-atom.ts`
- `template-context-atom.ts`
- `transcription-options.ts`
- `ui-prefs-atom.ts`

## Contexts (`src/contexts/`)

- `storage-context.tsx`

## Providers (`src/providers/`)

- `debug-provider.tsx`

## Notes

- Files are organized by functional area
- API routes follow Next.js App Router conventions
- Components are organized by feature area
- Library code is organized by domain (storage, chat, etc.)
- Type definitions are centralized in `src/types/`

