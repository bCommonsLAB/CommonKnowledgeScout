/**
 * @fileoverview Familien-Umzug (Welle 0e): Quelle + Twins in einem Zug.
 *
 * @description
 * Verschiebt/benennt eine Quelle MIT ihrer Twin-Familie um, ohne dass die
 * Datenbank-Verbindung oder das Spiegel-Layout bricht (Zyklus v2 §3,
 * Twin-Datei-Contract §7). Feste Reihenfolge:
 *
 * 1. IMPORT  — Handkorrekturen aus dem Spiegel nach Mongo holen (nie verlieren).
 * 2. SIBLINGS — Legacy-Artefakte neben der Quelle mit umziehen/umbenennen.
 * 3. QUELLE  — renameItem/moveItem (Provider-IDs sind auf OneDrive stabil).
 * 4. MONGO   — sourceName/parentId im Twin-Dokument nachziehen.
 * 5. SPIEGEL — alten `_`-Ordner loeschen (Inhalt ist seit Schritt 1 in Mongo).
 * 6. EXPORT  — Spiegel am neuen Ort mit neuem Namen regenerieren.
 *
 * Fehler brechen ab und werden gemeldet (kein stiller Teilerfolg); bereits
 * gelaufene Schritte stehen im Ergebnis, damit der Aufrufer den Zustand kennt.
 *
 * @module shadow-twin
 */

import type { Library } from '@/types/library'
import type { StorageProvider } from '@/lib/storage/types'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { isShadowTwinFolderName } from '@ks/util'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { updateShadowTwinSourceLocation } from '@/lib/repositories/shadow-twin-location'
import { selectSiblingArtifactFiles } from '@/lib/shadow-twin/shadow-twin-migration-writer'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { FileLogger } from '@/lib/debug/logger'
import path from 'path'

export interface MoveFamilyArgs {
  library: Library
  libraryId: string
  userEmail: string
  provider: StorageProvider
  sourceId: string
  /** Neuer Dateiname inkl. Endung (optional). */
  newName?: string
  /** Neuer Ziel-Ordner (optional). Mindestens eines von beiden ist Pflicht. */
  newParentId?: string
}

export interface MoveFamilyResult {
  imported: boolean
  renamedSiblings: string[]
  movedSource: boolean
  renamedSource: boolean
  mongoUpdated: boolean
  oldTwinFolderDeleted: boolean
  exported: boolean
}

/** Fuehrt den Familien-Umzug EINER Quelle aus (wirft bei Fehler). */
export async function moveFamily(args: MoveFamilyArgs): Promise<MoveFamilyResult> {
  const { libraryId, userEmail, provider, sourceId } = args
  const newName = args.newName?.trim() || undefined
  const newParentId = args.newParentId?.trim() || undefined
  if (!newName && !newParentId) {
    throw new Error('moveFamily: newName oder newParentId ist Pflicht')
  }

  const sourceItem = await provider.getItemById(sourceId)
  if (sourceItem.type !== 'file') {
    throw new Error('moveFamily gilt nur fuer Dateien (Ordner haben keine Twin-Familie)')
  }
  const oldName = sourceItem.metadata.name
  const oldParentId = sourceItem.parentId
  if (newName === oldName && (!newParentId || newParentId === oldParentId)) {
    throw new Error('moveFamily: Ziel ist identisch mit dem Ist-Zustand')
  }

  // SCHUTZ (Contract §2): Inhalte von Twin-Ordnern ziehen nie einzeln um,
  // und ein Twin-Ordner ist nie ein Umzugsziel — beides zerlegt Familien
  // (Nachzug zum Verschachtelungs-Befund vom 2026-08-21).
  const sourceParent = await provider.getItemById(oldParentId).catch(() => null)
  if (sourceParent && sourceParent.type === 'folder' && isShadowTwinFolderName(sourceParent.metadata.name)) {
    throw new Error(
      `Quelle liegt im Twin-Ordner "${sourceParent.metadata.name}" — Artefakte ziehen mit ihrer ` +
        'QUELLE um (moveFamily auf die Quelldatei), nie einzeln',
    )
  }
  if (newParentId) {
    const target = await provider.getItemById(newParentId).catch(() => null)
    if (!target || target.type !== 'folder') {
      throw new Error(`Ziel (newParentId=${newParentId}) ist kein existierender Ordner`)
    }
    if (isShadowTwinFolderName(target.metadata.name)) {
      throw new Error(
        `Twin-Ordner "${target.metadata.name}" ist kein Umzugsziel — Quelle im normalen Ordner ` +
          'ablegen, der Export baut den Spiegel daneben',
      )
    }
  }

  const result: MoveFamilyResult = {
    imported: false, renamedSiblings: [], movedSource: false, renamedSource: false,
    mongoUpdated: false, oldTwinFolderDeleted: false, exported: false,
  }

  const twinFolder = await findShadowTwinFolder(oldParentId, oldName, provider)
  const hadDoc = (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [sourceId] })).has(sourceId)

  // 1) IMPORT: Spiegel-/Sibling-Stand sichern, bevor irgendetwas bewegt wird.
  if (twinFolder || hadDoc) {
    await runLibrarySync({ libraryId, userEmail, mode: 'repair', preset: 'import', scope: { sourceIds: [sourceId] } })
    result.imported = true
  }

  // 2) SIBLINGS: Legacy-Artefakte neben der Quelle folgen der Familie.
  const oldStem = path.parse(oldName).name
  const newStem = newName ? path.parse(newName).name : oldStem
  const siblings = selectSiblingArtifactFiles(sourceItem, await provider.listItemsById(oldParentId))
  for (const sibling of siblings) {
    const siblingName = sibling.metadata.name
    if (newName && newStem !== oldStem) {
      const renamed = newStem + siblingName.slice(oldStem.length)
      await provider.renameItem(sibling.id, renamed)
      result.renamedSiblings.push(renamed)
    }
    if (newParentId && newParentId !== oldParentId) {
      await provider.moveItem(sibling.id, newParentId)
    }
  }

  // 3) QUELLE bewegen.
  if (newName && newName !== oldName) {
    await provider.renameItem(sourceId, newName)
    result.renamedSource = true
  }
  if (newParentId && newParentId !== oldParentId) {
    await provider.moveItem(sourceId, newParentId)
    result.movedSource = true
  }

  // 4) MONGO: Ort/Name des Twin-Dokuments nachziehen (nach Import ggf. neu entstanden).
  const hasDoc = hadDoc || (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [sourceId] })).has(sourceId)
  if (hasDoc) {
    await updateShadowTwinSourceLocation({
      libraryId, sourceId,
      sourceName: newName ?? oldName,
      parentId: newParentId ?? oldParentId,
    })
    result.mongoUpdated = true
  }

  // 5) Alten Spiegel loeschen (Inhalt seit Schritt 1 in Mongo).
  if (twinFolder) {
    await provider.deleteItem(twinFolder.id)
    result.oldTwinFolderDeleted = true
  }

  // 6) EXPORT: Spiegel am neuen Ort, korrekt benannt, regenerieren.
  if (hasDoc) {
    await runLibrarySync({ libraryId, userEmail, mode: 'repair', preset: 'export', scope: { sourceIds: [sourceId] } })
    result.exported = true
  }

  FileLogger.info('shadow-twin/move-family', 'Familien-Umzug abgeschlossen', {
    libraryId, sourceId, oldName, newName: newName ?? null, newParentId: newParentId ?? null, ...result,
    renamedSiblings: result.renamedSiblings.length,
  })
  return result
}
