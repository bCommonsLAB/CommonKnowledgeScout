/**
 * @fileoverview Leser des Archiv-Scans: Datei-Eintraege, Contract-Dateien, Twin-Ordner.
 *
 * @description
 * Aus `archive-scan.ts` ausgelagert (200-Zeilen-Regel, nach der Stapel-
 * Parallelisierung). Reine Helfer ohne eigene Zustandshaltung.
 *
 * @module agent-view
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin-folder-name'
import type { StorageItem } from '@/lib/storage/types'
import type { ArchiveScanProvider } from './archive-scan'
import type { ArchiveDocEntry, ArchiveFileEntry, ArchiveFolderNode, ArchiveTwinFolderEntry } from './archive-types'

/** Obergrenze fuer gelesene Contract-Dateien (Kosten-Zaun, sichtbar im Report). */
const MAX_DOC_BYTES = 512 * 1024

function toIso(value: Date | undefined): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  return value.toISOString()
}

export function toFileEntry(item: StorageItem, path: string): ArchiveFileEntry {
  return { fileId: item.id, name: item.metadata.name, path, modifiedAt: toIso(item.metadata.modifiedAt) }
}

export async function readDoc(
  provider: ArchiveScanProvider,
  item: StorageItem,
  path: string,
): Promise<ArchiveDocEntry> {
  const { blob } = await provider.getBinary(item.id)
  const raw = await blob.text()
  const markdown = raw.length > MAX_DOC_BYTES ? raw.slice(0, MAX_DOC_BYTES) : raw
  const { meta, body } = parseFrontmatter(markdown)
  return { ...toFileEntry(item, path), meta, body }
}

/** Erfasst einen `_`-Twin-Ordner, ohne ihn als Archiv-Ordner zu behandeln. */
export async function collectTwinFolder(
  provider: ArchiveScanProvider,
  item: StorageItem,
  path: string,
  siblingFileNames: ReadonlySet<string>,
  node: ArchiveFolderNode,
): Promise<ArchiveTwinFolderEntry> {
  // Twin-Ordnernamen sind auf 255 Zeichen gekuerzt — die Quelle wird deshalb
  // ueber DIESELBE Namensfunktion zurueckgerechnet, nicht per `slice(1)`
  // (sonst gilt eine lange Quelle faelschlich als verschwunden).
  const matchedSource = [...siblingFileNames].find(
    (name) => generateShadowTwinFolderName(name) === item.metadata.name,
  )
  const expectedSourceName = matchedSource ?? item.metadata.name.slice(1)
  let artifactNames: string[] = []
  try {
    artifactNames = (await provider.listItemsById(item.id))
      .filter((child) => child.type === 'file')
      .map((child) => child.metadata.name)
  } catch (error) {
    node.error = `Twin-Ordner ${item.metadata.name} nicht lesbar: ${error instanceof Error ? error.message : String(error)}`
  }
  return {
    folderId: item.id,
    name: item.metadata.name,
    path,
    expectedSourceName,
    sourcePresent: matchedSource !== undefined,
    artifactNames: artifactNames.sort((a, b) => a.localeCompare(b)),
  }
}
