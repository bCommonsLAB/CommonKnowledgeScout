/**
 * @fileoverview Fuehrt adopt-storage-only-source aus (Welle 5a).
 *
 * @description
 * Quelle ohne Mongo-Dokument: Artefakte (Markdown + Bilder) ueber den
 * bewaehrten Migrations-Writer uebernehmen. EIN prepare pro Quelle (laedt
 * Inhalte, spiegelt Bilder nach Azure), dann je Artefakt ein Upsert in den
 * jeweiligen Slot — mit dem ECHTEN Dateinamen, damit auch Legacy-Namen
 * ({base}.{lang}.md) ihren Inhalt finden.
 *
 * @module shadow-twin/sync-engine
 */

import { prepareSourceArtifacts, upsertArtifactFromPrepared } from '@/lib/shadow-twin/shadow-twin-migration-writer'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { SyncOperation } from '@/lib/shadow-twin/sync-plan/types'

/** Fuehrt die Adoption EINER Quelle aus (wirft bei Fehler; Aufrufer reportet). */
export async function executeAdoption(args: {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  sourceId: string
  sourceItem: StorageItem | null
  shadowTwinFolderId: string | null
  operation: SyncOperation
}): Promise<void> {
  const { libraryId, userEmail, provider, sourceId, sourceItem, shadowTwinFolderId, operation } = args
  if (!sourceItem) throw new Error('adopt-storage-only-source ohne Quell-Item (Scan-Kontext fehlt)')
  if (!operation.artifacts?.length) throw new Error('adopt-storage-only-source ohne Artefakt-Liste')

  const prepared = await prepareSourceArtifacts({
    libraryId, userEmail, sourceItem, provider,
    shadowTwinFolderId: shadowTwinFolderId ?? undefined,
  })
  for (const artifact of operation.artifacts) {
    await upsertArtifactFromPrepared({
      libraryId, userEmail, sourceItem,
      artifactKey: {
        sourceId, kind: artifact.kind,
        targetLanguage: artifact.targetLanguage, templateName: artifact.templateName,
      },
      prepared,
      artifactFileName: artifact.fileName,
    })
  }
}
