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
 * 3. QUELLE  — renameItem/moveItem. Die Id kann sich dabei AENDERN: OneDrive
 *              haelt sie stabil, Nextcloud/Filesystem kodieren den Pfad (Befund
 *              23.09.2026). Ab hier gilt die von Provider/Listing gelieferte Id.
 * 4. MONGO   — sourceName/parentId nachziehen, bei Id-Wechsel umschluesseln.
 * 5. SPIEGEL — alten `_`-Ordner loeschen (Inhalt ist seit Schritt 1 in Mongo).
 * 6. SCHAUFENSTER — Vektor-Eintrag (docs/doc-meta) auf die neue Id umschreiben.
 * 7. EXPORT  — Spiegel am neuen Ort mit neuem Namen regenerieren.
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
import { findeIdNachVerschieben, zieheSchaufensterNach } from '@/lib/shadow-twin/move-family-identity'
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
  /** Storage-Id der Quelle NACH dem Umzug — auf pfadbasierten Providern eine andere. */
  newSourceId: string
  sourceIdChanged: boolean
  /** Umgeschriebene Schaufenster-Dokumente; null = keine Vektor-Sammlung konfiguriert. */
  vectorsRekeyed: number | null
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
    newSourceId: sourceId, sourceIdChanged: false, vectorsRekeyed: 0,
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
    let siblingId = sibling.id
    if (newName && newStem !== oldStem) {
      const renamed = newStem + siblingName.slice(oldStem.length)
      siblingId = (await provider.renameItem(sibling.id, renamed)).id
      result.renamedSiblings.push(renamed)
    }
    if (newParentId && newParentId !== oldParentId) {
      await provider.moveItem(siblingId, newParentId)
    }
  }

  // 3) QUELLE bewegen — die Id von hier an nur noch aus Provider/Listing.
  const finalName = newName ?? oldName
  const finalParentId = newParentId ?? oldParentId
  let currentId = sourceId
  if (newName && newName !== oldName) {
    currentId = (await provider.renameItem(currentId, newName)).id
    result.renamedSource = true
  }
  if (newParentId && newParentId !== oldParentId) {
    await provider.moveItem(currentId, newParentId)
    currentId = await findeIdNachVerschieben(provider, newParentId, finalName)
    result.movedSource = true
  }
  result.newSourceId = currentId
  result.sourceIdChanged = currentId !== sourceId

  // 4) MONGO: Ort/Name des Twin-Dokuments nachziehen (nach Import ggf. neu
  //    entstanden), bei Id-Wechsel umschluesseln — sonst zeigt der Schluessel
  //    auf eine Datei, die es nicht mehr gibt.
  const hasDoc = hadDoc || (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [sourceId] })).has(sourceId)
  if (hasDoc) {
    await updateShadowTwinSourceLocation({
      libraryId, sourceId, sourceName: finalName, parentId: finalParentId,
      ...(result.sourceIdChanged ? { newSourceId: currentId } : {}),
    })
    result.mongoUpdated = true
  }

  // 5) Alten Spiegel loeschen (Inhalt seit Schritt 1 in Mongo).
  if (twinFolder) {
    await provider.deleteItem(twinFolder.id)
    result.oldTwinFolderDeleted = true
  }

  // 6) SCHAUFENSTER: docs/doc-meta haengen an der fileId — nachziehen, sonst
  //    steht der alte Eintrag stehen und die naechste Transformation legt einen
  //    zweiten daneben.
  if (result.sourceIdChanged) {
    result.vectorsRekeyed = (await zieheSchaufensterNach({ library: args.library, alteSourceId: sourceId, neueSourceId: currentId })).umgeschrieben
  }

  // 7) EXPORT: Spiegel am neuen Ort, korrekt benannt, regenerieren — mit der Id, die jetzt gilt.
  if (hasDoc) {
    await runLibrarySync({ libraryId, userEmail, mode: 'repair', preset: 'export', scope: { sourceIds: [currentId] } })
    result.exported = true
  }

  FileLogger.info('shadow-twin/move-family', 'Familien-Umzug abgeschlossen', {
    libraryId, sourceId, oldName, newName: newName ?? null, newParentId: newParentId ?? null, ...result,
    newSourceId: result.newSourceId,
    renamedSiblings: result.renamedSiblings.length,
  })
  return result
}
