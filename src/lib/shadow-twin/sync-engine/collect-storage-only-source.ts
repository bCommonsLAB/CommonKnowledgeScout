/**
 * @fileoverview Sammelt den Adoptions-Input einer Quelle OHNE Mongo-Dokument.
 *
 * @description
 * Welle 5a: Der Ordner-/Library-Scope ueberspringt Storage-only-Quellen nicht
 * mehr, sondern prueft ihren Twin-Ordner + Geschwister-Dateien auf Artefakte
 * (Namens-Analyse via {@link collectStorageArtifactsForSource}) und plant deren
 * Uebernahme (adopt-storage-only-source). Welle 5c liest zusaetzlich gezielt
 * die legacy-benannten und kanonischen Markdown-Dateien (Frontmatter-
 * Klassifikation) — alle uebrigen Dateien bleiben ohne Inhalt-Lesen.
 *
 * Liefert dieselben Formen wie der Doc-Pfad (CollectedSource + SourceSyncPlan),
 * damit run-library-sync beide Quell-Arten identisch behandelt.
 *
 * @module shadow-twin/sync-engine
 */

import { collectStorageArtifactsForSource } from '@/lib/shadow-twin/collect-storage-artifacts'
import { generateShadowTwinFolderNameVariants } from '@/lib/storage/shadow-twin'
import { planStorageAdoption } from '@/lib/shadow-twin/sync-plan/plan-storage-adoption'
import type { SourceSyncPlan } from '@/lib/shadow-twin/sync-plan/plan-source-sync'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { buildNameMigrationInput, collectAdoptionNameMigration, type NameMigrationContext } from './collect-name-migration'
import type { CollectedSource } from './collect-source-input'
import type { FolderCache } from './folder-cache'

/**
 * Sammelt Artefakte + Kontext einer Storage-only-Quelle und plant die Adoption.
 * Welle 5c: Legacy-Namen werden klassifiziert (Frontmatter-Lesen nur fuer
 * legacy-benannte + kanonische Markdown-Dateien); Muster-A-Dateien werden NICHT
 * als Transkript adoptiert, sondern umbenannt und unter neuem Namen adoptiert.
 * @returns null, wenn es weder Artefakte noch Namens-Befunde gibt (gewoehnliche,
 *          unverarbeitete Datei) — der Orchestrator zaehlt sie als `skippedWithoutDoc`.
 */
export async function collectStorageOnlySource(args: {
  sourceItem: StorageItem
  folderCache: FolderCache
  provider: StorageProvider
  nameMigrationCtx?: NameMigrationContext
}): Promise<{ collected: CollectedSource; plan: SourceSyncPlan } | null> {
  const { sourceItem, folderCache, provider, nameMigrationCtx } = args
  const sourceName = sourceItem.metadata.name
  const parentId = sourceItem.parentId

  // Twin-Ordner ueber Namens-Varianten in den (gecachten) Parent-Items finden —
  // wie migrate/route.ts, aber ohne zusaetzlichen Provider-Call.
  const parentItems = await folderCache.list(parentId)
  const variants = generateShadowTwinFolderNameVariants(sourceName)
  const twinFolder =
    parentItems.find((item) => item.type === 'folder' && variants.includes(item.metadata.name)) ?? null
  const twinFolderItems = twinFolder ? await folderCache.list(twinFolder.id) : []

  const allArtifacts = collectStorageArtifactsForSource({
    source: sourceItem,
    parentItems,
    shadowTwinFolderItems: twinFolderItems,
  })

  // Namens-Migration (Welle 5c): Muster-A-Dateien sind Transformationen im
  // Transkript-Namen — sie werden umbenannt statt falsch adoptiert.
  const nameMigrationCollected = nameMigrationCtx && allArtifacts.length > 0
    ? await collectAdoptionNameMigration({
        source: sourceItem, parentItems, twinFolderItems, provider,
        parentPathLength: nameMigrationCtx.parentPathLength,
      })
    : null
  const artifacts = nameMigrationCollected
    ? allArtifacts.filter((a) => !nameMigrationCollected.musterAFileIds.has(a.item.id))
    : allArtifacts
  if (artifacts.length === 0 && !nameMigrationCollected) return null

  const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')
  const plan = planStorageAdoption({
    sourceId: sourceItem.id,
    sourceName,
    artifacts: artifacts.map((a) => ({
      fileName: a.item.metadata.name,
      kind: a.key.kind,
      targetLanguage: a.key.targetLanguage,
      templateName: a.key.templateName,
    })),
    nameMigration: nameMigrationCollected && nameMigrationCtx
      ? buildNameMigrationInput(sourceBaseName, nameMigrationCollected, nameMigrationCtx)
      : undefined,
  })
  if (plan.operations.length === 0) return null

  const collected: CollectedSource = {
    input: {
      sourceId: sourceItem.id,
      sourceName,
      canonicalTranscriptName: `${sourceBaseName}.md`,
      transcriptCandidates: [],
      transformations: [],
    },
    shadowTwinFolderId: twinFolder?.id ?? null,
    twinFolderItems,
    sourceItem,
    parentId,
    collectNotes: [],
  }
  return { collected, plan }
}
