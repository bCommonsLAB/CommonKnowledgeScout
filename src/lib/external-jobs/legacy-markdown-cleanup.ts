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

  // WICHTIG: Prüfe, ob die Datei im Shadow-Twin-Verzeichnis liegt.
  // Wenn ja, handelt es sich um ein Transcript (korrektes Artefakt) und sollte NICHT gelöscht werden.
  // Nur Legacy-Dateien im Parent-Verzeichnis (PDF-Ordner) sollten gelöscht werden.
  try {
    const fileItem = await provider.getItemById(legacyMarkdownId)
    if (!fileItem) {
      // Datei existiert nicht mehr, nichts zu tun
      return
    }

    const fileParentId = fileItem.parentId
    const sourceParentId = preTemplateResult.internal?.parentId as string | undefined || 'root'
    
    // Prüfe, ob die Datei im Shadow-Twin-Verzeichnis liegt
    const { findShadowTwinFolder } = await import('@/lib/storage/shadow-twin')
    const shadowTwinFolder = await findShadowTwinFolder(sourceParentId, preTemplateResult.markdownFileName || '', provider)
    
    // Wenn die Datei im Shadow-Twin-Verzeichnis liegt, ist es ein Transcript → NICHT löschen
    if (shadowTwinFolder && fileParentId === shadowTwinFolder.id) {
      FileLogger.info('legacy-markdown-cleanup', 'Markdown liegt im Shadow-Twin-Verzeichnis (Transcript) - wird nicht gelöscht', {
        jobId,
        legacyMarkdownId,
        fileParentId,
        shadowTwinFolderId: shadowTwinFolder.id,
        fileName: preTemplateResult.markdownFileName,
      })
      return
    }

    // Nur löschen, wenn die Datei im Parent-Verzeichnis liegt (Legacy-Datei)
    if (fileParentId === sourceParentId) {
      await provider.deleteItem(legacyMarkdownId)
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'legacy_markdown_removed_from_parent',
          attributes: {
            legacyMarkdownId,
            parentId: fileParentId,
            fileName: preTemplateResult.markdownFileName,
          },
        })
      } catch {
        // Trace-Fehler nicht kritisch
      }
    } else {
      FileLogger.info('legacy-markdown-cleanup', 'Markdown liegt nicht im Parent-Verzeichnis - wird nicht gelöscht', {
        jobId,
        legacyMarkdownId,
        fileParentId,
        sourceParentId,
        fileName: preTemplateResult.markdownFileName,
      })
    }
  } catch (error) {
    // Fehler beim Löschen sind nicht kritisch für den Job, aber für Debugging interessant
    FileLogger.warn('legacy-markdown-cleanup', 'Fehler beim Prüfen/Löschen der Legacy-Markdown-Datei', {
      jobId,
      legacyMarkdownId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

