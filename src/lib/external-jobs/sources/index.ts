/**
 * @fileoverview Source Adapters - Export aller Source-Adapter
 *
 * @description
 * Zentrale Export-Datei für alle Source-Adapter.
 *
 * @module external-jobs/sources
 *
 * @exports
 * - MarkdownAdapter: Normalisierung von Markdown-Dateien
 * - TxtAdapter: Normalisierung von Plain-Text-Dateien
 * - SourceAdapter: Interface für Source-Adapter
 * - CanonicalMarkdownResult: Ergebnis der Normalisierung
 */

export { MarkdownAdapter } from './markdown-adapter'
export { TxtAdapter } from './txt-adapter'
export { WebsiteAdapter } from './website-adapter'
export type {
  SourceAdapter,
  SourceInput,
  SourceAdapterOptions,
  CanonicalMarkdownResult,
  SourceFormatType,
} from './types'
