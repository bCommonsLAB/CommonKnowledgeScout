/**
 * @fileoverview Fuehrt die Namens-Migrations-Operationen aus (Welle 5c).
 *
 * @description
 * - `migrate-legacy-artifact-name`: Rename der Legacy-Transformation auf die
 *   aktuelle Konvention (`{base}.{template}.{lang}.md`). Existiert der Ziel-Name
 *   bereits (Plan/Storage inzwischen auseinandergelaufen), schlaegt der Provider
 *   fehl — der Fehler landet im Report, es wird NICHTS ueberschrieben.
 * - `split-combined-artifact`: Kopie der Kombi-Datei unter dem Transformations-
 *   Namen in DENSELBEN Ordner wie das Original; der Inhalt kommt aus der
 *   Operation (zur Plan-Zeit gelesen), damit ein vorher ausgefuehrtes
 *   Ueberschreiben der kanonischen `{base}.md` den Split nicht verfaelscht.
 *
 * @module shadow-twin/sync-engine
 */

import type { SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import type { StorageProvider } from '@/lib/storage/types'
import type { FolderCache } from './folder-cache'

export interface ExecuteNameMigrationContext {
  provider: StorageProvider
  folderCache: FolderCache
  parentId: string
  shadowTwinFolderId: string | null
}

/** Fuehrt EINE Rename-/Split-Operation aus (wirft bei Fehler; Aufrufer reportet). */
export async function executeNameMigration(ctx: ExecuteNameMigrationContext, op: SyncOperation): Promise<void> {
  if (!op.fileId || !op.newFileName) {
    throw new Error(`${op.type} ohne fileId/newFileName (Plan-Fehler)`)
  }

  if (op.type === 'migrate-legacy-artifact-name') {
    await ctx.provider.renameItem(op.fileId, op.newFileName)
  } else if (op.type === 'split-combined-artifact') {
    if (typeof op.markdown !== 'string') {
      throw new Error('split-combined-artifact ohne Markdown-Inhalt (Plan-Fehler)')
    }
    const original = await ctx.provider.getItemById(op.fileId)
    await ctx.provider.uploadFile(
      original.parentId,
      new File([op.markdown], op.newFileName, { type: 'text/markdown' }),
    )
  } else {
    throw new Error(`executeNameMigration: unerwartete Operation ${op.type}`)
  }

  // Datei kann im Twin-Ordner ODER als Geschwister liegen — beide invalidieren.
  if (ctx.shadowTwinFolderId) ctx.folderCache.invalidate(ctx.shadowTwinFolderId)
  ctx.folderCache.invalidate(ctx.parentId)
}
