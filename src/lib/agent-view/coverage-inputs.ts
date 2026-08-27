/**
 * @fileoverview Aufbereitung der Scan-Eingaben fuer den Coverage-Service.
 *
 * @description
 * Reine Abbildungen zwischen den drei Datenquellen der Komposition:
 * Archiv-Scan (Ordner + Dateien), Sync-Engine-Report (Twin-Abdeckung) und
 * MongoDB-Twin-Familien. Hier entsteht KEINE Regel — nur die Indizes, mit
 * denen die Regeln arbeiten.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME, INDEX_FILE_NAME } from './archive-scan'
import type { ArchiveFileEntry, ArchiveFolderNode } from './archive-types'
import type { InventoryTarget } from './reference-audit'
import { inhaltsZeitpunkt } from './twin-rules'
import type { TwinArtifactView, TwinFamilyView } from './twin-rules'

/** Fundort einer Datei im Archiv-Scan. */
export interface FileLocation {
  folderId: string
  path: string
  name: string
  modifiedAt: string | null
}

/** Twin-Familie, wie sie aus MongoDB kommt (noch ohne Fundort). */
export interface RawTwinFamily {
  sourceId: string
  sourceName: string
  parentId: string
  artifacts: TwinArtifactView[]
}

/** Datei-Id → Fundort (Aufloesung von Engine-Zeilen und Twin-Familien). */
export function buildFileIndex(folders: readonly ArchiveFolderNode[]): Map<string, FileLocation> {
  const index = new Map<string, FileLocation>()
  for (const folder of folders) {
    for (const file of folder.files) {
      index.set(file.fileId, { folderId: folder.folderId, path: file.path, name: file.name, modifiedAt: file.modifiedAt })
    }
  }
  return index
}

/** Haengt Twin-Familien an ihren Fundort; unauffindbare landen an der Wurzel. */
export function locateFamilies(args: {
  families: readonly RawTwinFamily[]
  fileIndex: ReadonlyMap<string, FileLocation>
  folderIds: ReadonlySet<string>
  rootFolderId: string
}): TwinFamilyView[] {
  return args.families.map((family) => {
    const found = args.fileIndex.get(family.sourceId)
    if (found) return { ...family, folderId: found.folderId, path: found.path }
    // Quelle nicht im Scan: Elternordner nur nutzen, wenn er gescannt wurde —
    // sonst an die Wurzel haengen (der Befund `orphan_twin` macht das sichtbar).
    const folderId = args.folderIds.has(family.parentId) ? family.parentId : args.rootFolderId
    return { ...family, folderId, path: family.sourceName }
  })
}

/** Juengerer von zwei ISO-Zeitpunkten — auch der W8-Merge maximiert hierueber. */
export function newest(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/**
 * Juengste EIGENE Aenderung je Ordner (Dateien + Twin-Artefakte, OHNE
 * Teilbaum). Wandert als Kleinst-Skalar in die Baumknoten (W8): der Merge
 * leitet daraus die Teilbaum-Maxima fuer `stand_widerspruch` und
 * `bericht_veraltet` ab, ohne den Storage erneut zu lesen.
 */
export function buildOwnChangeByFolder(args: {
  folders: readonly ArchiveFolderNode[]
  families: readonly TwinFamilyView[]
}): Map<string, string | null> {
  const own = new Map<string, string | null>()
  for (const folder of args.folders) {
    let value: string | null = null
    for (const file of folder.files) {
      // Pilot-Befund B4: BERICHT.md/_INDEX.md sind META ueber den Inhalt,
      // nicht Inhalt — sonst altert jede Index-Pflege den frischen Bericht.
      if (file.name === BERICHT_FILE_NAME || file.name === INDEX_FILE_NAME) continue
      value = newest(value, file.modifiedAt)
    }
    own.set(folder.folderId, value)
  }
  for (const family of args.families) {
    let value = own.get(family.folderId) ?? null
    // Kurations-Stempel altern den Bericht NICHT (Befund 27.08.2026): Ein
    // Verifizieren schreibt das Artefakt, ist aber Meta ueber den Inhalt —
    // dieselbe Unterscheidung, die oben BERICHT.md/_INDEX.md ausnimmt. Sonst
    // macht jeder Pruef-Klick den frischen Bericht veraltet.
    for (const artifact of family.artifacts) value = newest(value, inhaltsZeitpunkt(artifact))
    own.set(family.folderId, value)
  }
  return own
}

/**
 * Juengste Aenderung je Teilbaum (Dateien + Twin-Artefakte), bottom-up.
 * Grundlage fuer `bericht_veraltet` und `stand_widerspruch`.
 */
export function buildNewestChangeBySubtree(args: {
  folders: readonly ArchiveFolderNode[]
  families: readonly TwinFamilyView[]
}): Map<string, string | null> {
  const own = buildOwnChangeByFolder(args)
  const result = new Map<string, string | null>(own)
  const byDepth = [...args.folders].sort((a, b) => b.depth - a.depth)
  for (const folder of byDepth) {
    if (folder.parentFolderId === null) continue
    const parent = result.get(folder.parentFolderId) ?? null
    result.set(folder.parentFolderId, newest(parent, result.get(folder.folderId) ?? null))
  }
  return result
}

/** Alle aufloesbaren Verweis-Ziele: Dateien, Ordner und Twin-Artefakte. */
export function buildInventoryTargets(args: {
  folders: readonly ArchiveFolderNode[]
  families: readonly TwinFamilyView[]
  fileIndex: ReadonlyMap<string, FileLocation>
}): InventoryTarget[] {
  const targets: InventoryTarget[] = []
  for (const folder of args.folders) {
    if (folder.path !== '') {
      targets.push({ path: folder.path, name: folder.name, modifiedAt: null, kind: 'folder' })
    }
    for (const file of folder.files) targets.push(fileTarget(file))
    for (const twin of folder.twinFolders) {
      targets.push({ path: twin.path, name: twin.name, modifiedAt: null, kind: 'folder' })
      for (const artifactName of twin.artifactNames) {
        targets.push({ path: `${twin.path}/${artifactName}`, name: artifactName, modifiedAt: null, kind: 'twin' })
      }
    }
  }
  // Twin-Artefakte aus MongoDB tragen die Zeitstempel, an denen sich
  // `verweis_veraltet` entscheidet (der Spiegel kann fehlen).
  for (const family of args.families) {
    const location = args.fileIndex.get(family.sourceId)
    const base = location ? location.path : family.sourceName
    for (const artifact of family.artifacts) {
      const name = artifactDisplayName(family.sourceName, artifact)
      targets.push({ path: `_${base}/${name}`, name, modifiedAt: artifact.updatedAt, kind: 'twin' })
    }
  }
  return targets
}

function fileTarget(file: ArchiveFileEntry): InventoryTarget {
  return { path: file.path, name: file.name, modifiedAt: file.modifiedAt, kind: 'file' }
}

/** Erwarteter Dateiname eines Artefakts (Contract §2, ohne Storage-Zugriff). */
function artifactDisplayName(sourceName: string, artifact: TwinArtifactView): string {
  const dot = sourceName.lastIndexOf('.')
  const base = dot > 0 ? sourceName.slice(0, dot) : sourceName
  if (artifact.kind === 'transformation') {
    return `${base}.${artifact.templateName ?? 'unknown'}.${artifact.targetLanguage || 'de'}.md`
  }
  return `${base}.md`
}
