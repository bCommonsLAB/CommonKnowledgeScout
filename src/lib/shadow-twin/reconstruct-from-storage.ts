/**
 * @fileoverview Rekonstruktion von Shadow-Twin-Artefakten aus dem Storage
 *
 * @description
 * Scannt einen Shadow-Twin-Ordner im Storage und erstellt fehlende
 * MongoDB-Eintraege aus den vorhandenen Artefakt-Dateien.
 *
 * Wird verwendet von:
 * - /api/.../shadow-twins/reconstruct (manueller Button)
 * - /api/.../artifacts/resolve (automatische Lazy-Rekonstruktion)
 *
 * @module shadow-twin
 */

import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { upsertShadowTwinArtifact } from '@/lib/repositories/shadow-twin-repo'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

/** Ergebnis pro rekonstruiertem Artefakt */
export interface ReconstructedArtifact {
  fileName: string
  kind: string
  targetLanguage: string | null
  templateName: string | null
  success: boolean
  error?: string
}

/**
 * Liest alle Markdown-Dateien aus dem Shadow-Twin-Ordner und erstellt
 * MongoDB-Eintraege daraus.
 *
 * Idempotent: upsertShadowTwinArtifact aktualisiert bestehende Eintraege.
 */
export async function reconstructFromFolder(args: {
  provider: StorageProvider
  libraryId: string
  userEmail: string
  sourceId: string
  sourceName: string
  parentId: string
  shadowTwinFolderId: string
}): Promise<ReconstructedArtifact[]> {
  const { provider, libraryId, userEmail, sourceId, sourceName, parentId, shadowTwinFolderId } = args
  const results: ReconstructedArtifact[] = []

  const items = await provider.listItemsById(shadowTwinFolderId)
  const mdFiles = items.filter(
    (item) => item.type === 'file' && item.metadata.name.endsWith('.md')
  )

  if (mdFiles.length === 0) {
    FileLogger.info('shadow-twins/reconstruct', 'Keine Markdown-Dateien im Shadow-Twin-Ordner gefunden', {
      sourceId, shadowTwinFolderId,
    })
    return results
  }

  // Basisname der Quelldatei fuer parseArtifactName
  const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')

  for (const mdFile of mdFiles) {
    const fileName = mdFile.metadata.name
    const parsed = parseArtifactName(fileName, sourceBaseName)

    if (!parsed.kind || !parsed.targetLanguage) {
      FileLogger.warn('shadow-twins/reconstruct', 'Artefakt-Datei konnte nicht zugeordnet werden', {
        fileName, parsed, sourceId,
      })
      results.push({
        fileName,
        kind: parsed.kind || 'unknown',
        targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName,
        success: false,
        error: 'Dateiname konnte nicht als Artefakt erkannt werden',
      })
      continue
    }

    try {
      const { blob } = await provider.getBinary(mdFile.id)
      const markdown = await blob.text()

      if (!markdown.trim()) {
        results.push({
          fileName, kind: parsed.kind, targetLanguage: parsed.targetLanguage,
          templateName: parsed.templateName, success: false, error: 'Leere Datei',
        })
        continue
      }

      const artifactKey: ArtifactKey = {
        sourceId,
        kind: parsed.kind,
        targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName || undefined,
      }

      await upsertShadowTwinArtifact({
        libraryId, userEmail, sourceId, sourceName, parentId, artifactKey, markdown,
      })

      FileLogger.info('shadow-twins/reconstruct', `Artefakt rekonstruiert: ${fileName}`, {
        sourceId, kind: parsed.kind, lang: parsed.targetLanguage, template: parsed.templateName,
      })

      results.push({
        fileName, kind: parsed.kind, targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName, success: true,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      FileLogger.error('shadow-twins/reconstruct', `Fehler beim Rekonstruieren: ${fileName}`, {
        sourceId, error: errorMsg,
      })
      results.push({
        fileName, kind: parsed.kind, targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName, success: false, error: errorMsg,
      })
    }
  }

  return results
}
