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
 * Guard (Welle 5c): Artefakte, deren Datei beim Ausfuehren NICHT im Twin-Ordner
 * liegt, werden uebersprungen und geloggt statt mit LEEREM Inhalt upsertet.
 * Das betrifft Namens-Migrations-Ziele, deren Rename/Split nicht lief
 * (z.B. import-Preset oder Rename-Fehler), und Sibling-Artefakte (der
 * Migrations-Writer laedt nur Twin-Ordner-Inhalte).
 *
 * @module shadow-twin/sync-engine
 */

import { prepareSourceArtifacts, upsertArtifactFromPrepared } from '@/lib/shadow-twin/shadow-twin-migration-writer'
import { FileLogger } from '@/lib/debug/logger'
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
  const availableLower = new Set(Array.from(prepared.markdownByName.keys(), (n) => n.toLowerCase()))
  const adoptable = operation.artifacts.filter((a) => availableLower.has(a.fileName.toLowerCase()))
  const skipped = operation.artifacts.filter((a) => !availableLower.has(a.fileName.toLowerCase()))
  if (skipped.length > 0) {
    FileLogger.warn('shadow-twins/sync-engine', 'Adoption: Artefakt-Datei(en) nicht im Twin-Ordner — uebersprungen (kein Leer-Upsert)', {
      sourceId, skipped: skipped.map((a) => a.fileName),
    })
  }
  for (const artifact of adoptable) {
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
