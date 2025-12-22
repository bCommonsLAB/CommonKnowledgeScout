/**
 * @fileoverview Legacy-Markdown-Übernahme in Shadow-Twin-Verzeichnis
 *
 * @description
 * Konsolidiert die Logik zur Übernahme von Legacy-Markdown-Dateien aus dem PDF-Ordner
 * in das Shadow-Twin-Verzeichnis. Wird verwendet, wenn eine alte transformierte
 * Markdown-Datei neben dem PDF existiert und valides Frontmatter hat (TC-2.5 Reparatur-Szenario).
 *
 * @module external-jobs
 */

import type { RequestContext } from '@/types/external-jobs'
import type { PreprocessTransformTemplateResult } from '@/lib/external-jobs/preprocessor-transform-template'
import type { StorageProvider } from '@/lib/storage/types'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Übernimmt eine Legacy-Markdown-Datei aus dem PDF-Ordner in das Shadow-Twin-Verzeichnis.
 *
 * @param ctx Request-Kontext mit Job-Informationen
 * @param preTemplateResult Ergebnis des Template-Preprozessors
 * @param provider Storage-Provider
 * @param repo External-Jobs-Repository
 * @returns true wenn Übernahme erfolgreich war oder nicht nötig war, false bei Fehler
 */
export async function adoptLegacyMarkdownToShadowTwin(
  ctx: RequestContext,
  preTemplateResult: PreprocessTransformTemplateResult | null | undefined,
  provider: StorageProvider,
  repo: ExternalJobsRepository
): Promise<boolean> {
  const { jobId, job } = ctx

  // Prüfe, ob Legacy-Datei vorhanden ist und Frontmatter valide ist
  const legacyMarkdownId = preTemplateResult?.markdownFileId
  if (!legacyMarkdownId || !preTemplateResult?.hasFrontmatter || !preTemplateResult.frontmatterValid) {
    // Keine Legacy-Datei oder Frontmatter nicht valide → keine Übernahme nötig
    return true
  }

  try {
    const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
    const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
    const parentId = job.correlation?.source?.parentId || 'root'
    const originalName = job.correlation.source?.name || 'output'

    // Prüfe, ob Shadow-Twin-Verzeichnis existiert
    let shadowTwinFolder = await findShadowTwinFolder(parentId, originalName, provider)
    if (!shadowTwinFolder) {
      // Shadow-Twin-Verzeichnis erstellen, falls nicht vorhanden
      const folderName = generateShadowTwinFolderName(originalName)
      shadowTwinFolder = await provider.createFolder(parentId, folderName)
      FileLogger.info('legacy-markdown-adoption', 'Shadow-Twin-Verzeichnis für Legacy-Datei erstellt', {
        jobId,
        folderId: shadowTwinFolder.id,
        folderName,
      })
    }

    // Prüfe, ob die transformierte Datei (mit Language-Suffix) bereits im Shadow-Twin-Verzeichnis existiert
    // WICHTIG: Wir prüfen spezifisch nach der transformierten Datei (.de.md), nicht nach der Transcript-Datei (.md)
    const transformedName = `${baseName}.${lang}.md`
    const items = await provider.listItemsById(shadowTwinFolder.id)
    const existingTransformed = items.find(
      item => item.type === 'file' && item.metadata.name === transformedName
    )
    
    if (!existingTransformed) {
      // Transformierte Datei existiert nicht im Shadow-Twin → Legacy-Datei verschieben
      await provider.moveItem(legacyMarkdownId, shadowTwinFolder.id)
      FileLogger.info('legacy-markdown-adoption', 'Legacy-Datei in Shadow-Twin-Verzeichnis übernommen', {
        jobId,
        legacyMarkdownId,
        shadowTwinFolderId: shadowTwinFolder.id,
        transformedName,
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'legacy_markdown_adopted_to_shadow_twin',
          attributes: {
            legacyMarkdownId,
            shadowTwinFolderId: shadowTwinFolder.id,
            transformedName,
          },
        })
      } catch {
        // Trace-Fehler nicht kritisch
      }
    } else {
      // Transformierte Datei existiert bereits im Shadow-Twin.
      //
      // WICHTIG (Bugfix):
      // In manchen Fällen zeigt `legacyMarkdownId` bereits auf genau die transformierte Datei
      // im Shadow-Twin-Verzeichnis (also `legacyMarkdownId === existingTransformed.id`).
      // Dann darf NICHT gelöscht werden – sonst verschwindet die korrekte Datei samt Frontmatter
      // und der Ingest-Step scheitert anschließend mit ENOENT / "Shadow‑Twin nicht gefunden".
      if (legacyMarkdownId !== existingTransformed.id) {
        // Legacy-Datei (außerhalb des Shadow-Twin) löschen – Duplikatbereinigung
        await provider.deleteItem(legacyMarkdownId)
        FileLogger.info('legacy-markdown-adoption', 'Legacy-Datei gelöscht (transformierte Datei bereits im Shadow-Twin vorhanden)', {
          jobId,
          legacyMarkdownId,
          existingTransformedId: existingTransformed.id,
          transformedName,
        })
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'legacy_markdown_removed_duplicate_in_shadow_twin',
            attributes: {
              legacyMarkdownId,
              shadowTwinFolderId: shadowTwinFolder.id,
              existingTransformedId: existingTransformed.id,
              transformedName,
            },
          })
        } catch {
          // Trace-Fehler nicht kritisch
        }
      } else {
        FileLogger.warn('legacy-markdown-adoption', 'Legacy-Markdown entspricht bereits der transformierten Datei – kein Delete', {
          jobId,
          legacyMarkdownId,
          existingTransformedId: existingTransformed.id,
          transformedName,
        })
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'legacy_markdown_skip_delete_same_id',
            attributes: {
              legacyMarkdownId,
              shadowTwinFolderId: shadowTwinFolder.id,
              existingTransformedId: existingTransformed.id,
              transformedName,
            },
          })
        } catch {
          // Trace-Fehler nicht kritisch
        }
      }
    }

    return true
  } catch (error) {
    FileLogger.error('legacy-markdown-adoption', 'Fehler beim Übernehmen der Legacy-Datei in Shadow-Twin', {
      jobId,
      legacyMarkdownId,
      error: error instanceof Error ? error.message : String(error),
    })
    // Fehler ist nicht kritisch - Job kann trotzdem fortgesetzt werden
    return false
  }
}




