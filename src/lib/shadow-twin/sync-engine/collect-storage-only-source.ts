/**
 * @fileoverview Sammelt den Adoptions-Input einer Quelle OHNE Mongo-Dokument.
 *
 * @description
 * Welle 5a: Der Ordner-/Library-Scope ueberspringt Storage-only-Quellen nicht
 * mehr, sondern prueft ihren Twin-Ordner + Geschwister-Dateien auf Artefakte
 * (Namens-Analyse via {@link collectStorageArtifactsForSource}, KEIN
 * Inhalt-Lesen) und plant deren Uebernahme (adopt-storage-only-source).
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
import type { StorageItem } from '@/lib/storage/types'
import type { CollectedSource } from './collect-source-input'
import type { FolderCache } from './folder-cache'

/**
 * Sammelt Artefakte + Kontext einer Storage-only-Quelle und plant die Adoption.
 * @returns null, wenn es nichts zu adoptieren gibt (gewoehnliche, unverarbeitete
 *          Datei) — der Orchestrator zaehlt sie als `skippedWithoutDoc`.
 */
export async function collectStorageOnlySource(args: {
  sourceItem: StorageItem
  folderCache: FolderCache
}): Promise<{ collected: CollectedSource; plan: SourceSyncPlan } | null> {
  const { sourceItem, folderCache } = args
  const sourceName = sourceItem.metadata.name
  const parentId = sourceItem.parentId

  // Twin-Ordner ueber Namens-Varianten in den (gecachten) Parent-Items finden —
  // wie migrate/route.ts, aber ohne zusaetzlichen Provider-Call.
  const parentItems = await folderCache.list(parentId)
  const variants = generateShadowTwinFolderNameVariants(sourceName)
  const twinFolder =
    parentItems.find((item) => item.type === 'folder' && variants.includes(item.metadata.name)) ?? null
  const twinFolderItems = twinFolder ? await folderCache.list(twinFolder.id) : []

  const artifacts = collectStorageArtifactsForSource({
    source: sourceItem,
    parentItems,
    shadowTwinFolderItems: twinFolderItems,
  })
  if (artifacts.length === 0) return null

  const plan = planStorageAdoption({
    sourceId: sourceItem.id,
    sourceName,
    artifacts: artifacts.map((a) => ({
      fileName: a.item.metadata.name,
      kind: a.key.kind,
      targetLanguage: a.key.targetLanguage,
      templateName: a.key.templateName,
    })),
  })

  const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')
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
