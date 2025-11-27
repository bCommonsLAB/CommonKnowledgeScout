/**
 * @fileoverview Legacy-Markdown-Bereinigung nach Template-Transformation
 *
 * @description
 * Entfernt Legacy-Markdown-Dateien aus dem PDF-Ordner nach erfolgreichem Template-Lauf.
 * Wird verwendet, wenn eine alte transformierte Markdown-Datei ohne Frontmatter im PDF-Ordner
 * existiert und durch eine neue Template-Transformation ersetzt wurde (TC-2.5 Reparatur-Szenario).
 *
 * @module external-jobs
 */

import type { PreprocessTransformTemplateResult } from '@/lib/external-jobs/preprocessor-transform-template'
import type { StorageProvider } from '@/lib/storage/types'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Bereinigt Legacy-Markdown-Datei aus dem PDF-Ordner nach erfolgreichem Template-Lauf.
 *
 * @param jobId Job-ID
 * @param legacyMarkdownId ID der Legacy-Markdown-Datei
 * @param preTemplateResult Ergebnis des Template-Preprozessors
 * @param provider Storage-Provider
 * @param repo External-Jobs-Repository
 */
export async function cleanupLegacyMarkdownAfterTemplate(
  jobId: string,
  legacyMarkdownId: string | undefined,
  preTemplateResult: PreprocessTransformTemplateResult | null | undefined,
  provider: StorageProvider,
  repo: ExternalJobsRepository
): Promise<void> {
  // Bedingung: Preprozessor meldet Markdown im Parent-Verzeichnis, aber kein Frontmatter → Reparaturlauf.
  if (!legacyMarkdownId || !preTemplateResult || !preTemplateResult.hasMarkdown || preTemplateResult.hasFrontmatter) {
    return
  }

  try {
    await provider.deleteItem(legacyMarkdownId)
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'template',
        name: 'legacy_markdown_removed_from_parent',
        attributes: {
          legacyMarkdownId,
          parentId: preTemplateResult.markdownFileId ? 'unknown' : 'unknown', // parentId wird nicht benötigt für Trace
        },
      })
    } catch {
      // Trace-Fehler nicht kritisch
    }
  } catch (error) {
    // Fehler beim Löschen sind nicht kritisch für den Job, aber für Debugging interessant
    FileLogger.warn('legacy-markdown-cleanup', 'Legacy-Markdown konnte nicht aus PDF-Ordner gelöscht werden', {
      jobId,
      legacyMarkdownId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

