/**
 * @fileoverview Fuehrt die erlaubten Operationen EINER Quelle aus (repair-Modus).
 *
 * @description
 * Schreib-Primitiven: Transkript-Paar via ShadowTwinService (getesteter Writer,
 * Mongo + kanonische Datei); Nur-Mongo via updateShadowTwinArtifactMarkdown;
 * Nur-Spiegel via Provider-Upload (Export ohne Mongo-Write); Bilder via
 * Azure-Download bzw. reconstructPageImages (B1); Loeschungen 404-tolerant.
 * Fehler einer Operation brechen die Quelle nicht ab — jede Operation bekommt
 * ein eigenes Ergebnis (executed/error) fuer den Report.
 *
 * @module shadow-twin/sync-engine
 */

import { updateShadowTwinArtifactMarkdown } from '@/lib/repositories/shadow-twin-repo'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { reconstructPageImages } from '@/lib/shadow-twin/reconstruct-from-storage'
import { executeAdoption } from './execute-adoption'
import { executeNameMigration } from './execute-name-migration'
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import type { Library } from '@/types/library'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import type { FolderCache } from './folder-cache'

export interface OperationOutcome {
  operation: SyncOperation
  executed: boolean
  error?: string
}

export interface ExecuteSourceContext {
  library: Library
  libraryId: string
  userEmail: string
  provider: StorageProvider
  folderCache: FolderCache
  sourceId: string
  sourceName: string
  parentId: string
  shadowTwinFolderId: string | null
  twinFolderItems: StorageItem[]
  sourceItem: StorageItem | null
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Wahrer Eltern-Ordner fuer Storage-Writes: der Live-Scan-Fund schlaegt den
 * Mongo-Verweis. Pilot-Befund B1 (2026-08-21): `doc.parentId` kann nach
 * Umzuegen/Neuanlagen veraltet sein — dann scheiterte der Export mit
 * „The resource could not be found“, waehrend der Job-Pfad (loest die Quelle
 * live auf) durchlief. Ohne Scan-Fund bleibt der Mongo-Verweis die einzige
 * Quelle.
 */
function effectiveParentId(ctx: ExecuteSourceContext): string {
  const live = ctx.sourceItem?.parentId?.trim() ?? ''
  return live !== '' ? live : ctx.parentId
}

/** Twin-Ordner sicherstellen (finden oder anlegen); cached die Id im Kontext. */
async function ensureTwinFolderId(ctx: ExecuteSourceContext): Promise<string> {
  if (ctx.shadowTwinFolderId) return ctx.shadowTwinFolderId
  const parentId = effectiveParentId(ctx)
  const existing = await findShadowTwinFolder(parentId, ctx.sourceName, ctx.provider)
  const folder = existing ?? (await ctx.provider.createFolder(parentId, generateShadowTwinFolderName(ctx.sourceName)))
  ctx.shadowTwinFolderId = folder.id
  return folder.id
}

/** Markdown als Datei in den Twin-Ordner schreiben (optional bestehende ersetzen). */
async function uploadMarkdown(ctx: ExecuteSourceContext, op: SyncOperation): Promise<void> {
  if (!op.markdown) throw new Error('Operation ohne Markdown-Inhalt')
  const folderId = await ensureTwinFolderId(ctx)
  if (op.overwrite && op.fileId) {
    try {
      await ctx.provider.deleteItem(op.fileId)
    } catch (err) {
      // 404 = schon weg → Ziel erreicht; alles andere ist ein echter Fehler.
      if (!/404|not found/i.test(message(err))) throw err
    }
  }
  await ctx.provider.uploadFile(folderId, new File([op.markdown], op.fileName, { type: 'text/markdown' }))
  ctx.folderCache.invalidate(folderId)
}

/** Fuehrt EINE Operation aus (wirft bei Fehler; Aufrufer sammelt Ergebnisse). */
async function executeOperation(ctx: ExecuteSourceContext, op: SyncOperation): Promise<void> {
  switch (op.type) {
    case 'update-mongo-transcript':
      // Nur-Mongo-Write (auto-sync, repair ohne persistToFilesystem). Das Paar
      // MIT Storage-Spiegel behandelt executeSourcePlan ueber den Service.
      await updateShadowTwinArtifactMarkdown({
        libraryId: ctx.libraryId, sourceId: ctx.sourceId,
        artifactKey: { sourceId: ctx.sourceId, kind: 'transcript', targetLanguage: '' },
        markdown: op.markdown ?? '',
      })
      return
    case 'write-canonical-transcript':
      // Nur Storage-Spiegel (Export bzw. Mongo bereits korrekt): reiner
      // Provider-Write ohne Mongo-Write.
      await uploadMarkdown(ctx, op)
      return
    case 'update-mongo-transformation':
      if (!op.templateName) throw new Error('update-mongo-transformation ohne templateName (ArtifactKey-Contract)')
      await updateShadowTwinArtifactMarkdown({
        libraryId: ctx.libraryId, sourceId: ctx.sourceId,
        artifactKey: { sourceId: ctx.sourceId, kind: 'transformation', targetLanguage: op.targetLanguage, templateName: op.templateName },
        markdown: op.markdown ?? '',
      })
      return
    case 'mirror-artifact-to-storage':
      await uploadMarkdown(ctx, op)
      return
    case 'mirror-image-to-storage': {
      if (!op.url) throw new Error('mirror-image-to-storage ohne Quell-URL')
      const response = await fetch(op.url)
      if (!response.ok) throw new Error(`Azure-Download fehlgeschlagen (${response.status})`)
      const buffer = await response.arrayBuffer()
      const folderId = await ensureTwinFolderId(ctx)
      await ctx.provider.uploadFile(folderId, new File([buffer], op.fileName))
      ctx.folderCache.invalidate(folderId)
      return
    }
    case 'register-image-fragments': {
      if (!ctx.sourceItem) throw new Error('register-image-fragments ohne Quell-Item (Scan-Kontext fehlt)')
      await reconstructPageImages({
        provider: ctx.provider, libraryId: ctx.libraryId, userEmail: ctx.userEmail,
        sourceItem: ctx.sourceItem, parentId: ctx.parentId, items: ctx.twinFolderItems,
      })
      return
    }
    case 'adopt-storage-only-source':
      // Welle 5a: Quelle ohne Mongo-Dokument — Uebernahme via Migrations-Writer.
      // Welle 0c: Ordner der Quelle mitgeben (Folder-Cache, kein Extra-Call),
      // damit auch Sidecar-Artefakte des Legacy-Layouts geladen werden. Nach
      // Rename/Split ist der Cache invalidiert -> die Liste ist aktuell.
      await executeAdoption({
        libraryId: ctx.libraryId, userEmail: ctx.userEmail, provider: ctx.provider,
        sourceId: ctx.sourceId, sourceItem: ctx.sourceItem,
        shadowTwinFolderId: ctx.shadowTwinFolderId,
        parentItems: await ctx.folderCache.list(ctx.parentId),
        operation: op,
      })
      return
    case 'delete-inferior-variant':
    case 'delete-dead-page-md': {
      if (!op.fileId) throw new Error(`${op.type} ohne fileId`)
      try {
        await ctx.provider.deleteItem(op.fileId)
      } catch (err) {
        // 404 = bereits weg (z.B. durch vorheriges Overwrite ersetzt) → Ziel erreicht.
        if (!/404|not found/i.test(message(err))) throw err
      }
      if (ctx.shadowTwinFolderId) ctx.folderCache.invalidate(ctx.shadowTwinFolderId)
      return
    }
    case 'migrate-legacy-artifact-name':
    case 'split-combined-artifact':
      // Welle 5c: Rename/Split laufen in Plan-Reihenfolge VOR der Adoption.
      await executeNameMigration(ctx, op)
      return
    case 'needs-pipeline':
    case 'conflict':
    case 'legacy-transcript-name':
    case 'path-too-long':
      throw new Error(`Report-only-Operation darf nicht ausgefuehrt werden: ${op.type}`)
    default: {
      const exhaustive: never = op.type
      throw new Error(`Unbekannte Operation: ${String(exhaustive)}`)
    }
  }
}

/**
 * Fuehrt die erlaubten Operationen einer Quelle in Plan-Reihenfolge aus.
 * WICHTIG: Die Plan-Reihenfolge stellt sicher, dass Gewinner-Writes VOR den
 * Loeschungen laufen (Sicherheitsregel: nie die einzige Kopie verlieren).
 */
export async function executeSourcePlan(
  allowedOperations: ReadonlyArray<SyncOperation>,
  ctx: ExecuteSourceContext,
): Promise<OperationOutcome[]> {
  const outcomes: OperationOutcome[] = []
  const mongoOp = allowedOperations.find((op) => op.type === 'update-mongo-transcript')
  const canonicalOp = allowedOperations.find((op) => op.type === 'write-canonical-transcript')
  let transcriptWriteFailed = false

  // 1) Transkript-Gewinner ZUERST persistieren. Sind beide Operationen erlaubt,
  //    schreibt der getestete Service-Writer Mongo + kanonische Datei in einem
  //    Zug (wie reconcile heute) — beide teilen sich das Ergebnis.
  if (mongoOp && canonicalOp) {
    try {
      await new ShadowTwinService({
        library: ctx.library, userEmail: ctx.userEmail, sourceId: ctx.sourceId,
        sourceName: ctx.sourceName, parentId: effectiveParentId(ctx), provider: ctx.provider,
      }).upsertMarkdown({
        kind: 'transcript', targetLanguage: '', markdown: mongoOp.markdown ?? '',
        shadowTwinFolderId: ctx.shadowTwinFolderId ?? undefined,
      })
      outcomes.push({ operation: canonicalOp, executed: true }, { operation: mongoOp, executed: true })
    } catch (err) {
      const error = message(err)
      outcomes.push({ operation: canonicalOp, executed: false, error }, { operation: mongoOp, executed: false, error })
      transcriptWriteFailed = true
    }
  } else if (mongoOp || canonicalOp) {
    const op = (mongoOp ?? canonicalOp) as SyncOperation
    try {
      await executeOperation(ctx, op)
      outcomes.push({ operation: op, executed: true })
    } catch (err) {
      outcomes.push({ operation: op, executed: false, error: message(err) })
      transcriptWriteFailed = true
    }
  }

  // 2) Restliche Operationen in Plan-Reihenfolge. Sicherheitsregel: schlug der
  //    Gewinner-Write fehl, werden unterlegene Varianten NICHT geloescht.
  for (const op of allowedOperations) {
    if (op === mongoOp || op === canonicalOp) continue
    if (op.type === 'delete-inferior-variant' && transcriptWriteFailed) {
      outcomes.push({ operation: op, executed: false, error: 'Uebersprungen: Gewinner konnte nicht geschrieben werden' })
      continue
    }
    try {
      await executeOperation(ctx, op)
      outcomes.push({ operation: op, executed: true })
    } catch (err) {
      outcomes.push({ operation: op, executed: false, error: message(err) })
    }
  }
  return outcomes
}
