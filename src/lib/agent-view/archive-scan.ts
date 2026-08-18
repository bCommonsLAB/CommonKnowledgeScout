/**
 * @fileoverview Archiv-Scan der Agentensicht: Ordnerbaum + Contract-Dateien.
 *
 * @description
 * Sammelt genau das, was KEINE vorhandene Maschine liefert: den Ordnerbaum mit
 * `_INDEX.md`/`BERICHT.md` (Frontmatter UND Body — der Body ist die Grundlage
 * des Verweis-Audits) sowie die Datei-Inventur je Ordner. Die Twin-Abdeckung
 * kommt weiterhin AUSSCHLIESSLICH aus dem Sync-Engine-Check — hier wird nichts
 * doppelt geprueft (Leitprinzip 1).
 *
 * Wiederverwendet die Scan-Primitive der Engine: Ausschluss-Muster
 * (`scan-exclude.ts`, Welle 0b) und die Twin-Ordner-Erkennung
 * (`shadow-twin-folder-name.ts`). Ordner-Lesefehler werden je Teilbaum
 * ISOLIERT und im Knoten ausgewiesen (`no-silent-fallbacks.mdc`).
 *
 * @module agent-view
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { compileExcludeGlobs, isExcludedPath } from '@/lib/shadow-twin/sync-engine/scan-exclude'
import { generateShadowTwinFolderName, isShadowTwinFolderName } from '@/lib/storage/shadow-twin-folder-name'
import type { StorageItem } from '@/lib/storage/types'
import { readBearbeitungsstand } from './bearbeitungsstand'
import type { ArchiveDocEntry, ArchiveFileEntry, ArchiveFolderNode, ArchiveScanResult, ArchiveTwinFolderEntry } from './archive-types'

/** Minimal-Port auf den Storage (nur Lesen) — haelt den Scan testbar. */
export interface ArchiveScanProvider {
  listItemsById(folderId: string): Promise<StorageItem[]>
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }>
}

export const INDEX_FILE_NAME = '_INDEX.md'
export const BERICHT_FILE_NAME = 'BERICHT.md'

/** Obergrenze fuer gelesene Contract-Dateien (Kosten-Zaun, sichtbar im Report). */
const MAX_DOC_BYTES = 512 * 1024

function toIso(value: Date | undefined): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  return value.toISOString()
}

function toFileEntry(item: StorageItem, path: string): ArchiveFileEntry {
  return { fileId: item.id, name: item.metadata.name, path, modifiedAt: toIso(item.metadata.modifiedAt) }
}

async function readDoc(
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

interface QueueEntry {
  folderId: string
  name: string
  path: string
  parentFolderId: string | null
  depth: number
}

/**
 * Laeuft den Ordnerbaum ab der Scan-Wurzel ab. Twin-Ordner werden NICHT
 * betreten (ihre Dateien gehoeren zur Twin-Familie, nicht ins Archiv-Inventar),
 * aber als `twinFolders` erfasst — inklusive der Frage, ob ihre Quelle noch da
 * ist (Grundlage fuer `orphan_twin`).
 */
export async function scanArchive(args: {
  provider: ArchiveScanProvider
  rootFolderId: string
  excludeGlobs?: readonly string[]
  /** Sicherheitsnetz gegen Endlosbaeume (Report weist Abbruch als Fehler aus). */
  maxFolders?: number
}): Promise<ArchiveScanResult> {
  const { provider, rootFolderId, maxFolders = 5000 } = args
  const exclude = compileExcludeGlobs(args.excludeGlobs)
  const folders: ArchiveFolderNode[] = []
  const queue: QueueEntry[] = [{ folderId: rootFolderId, name: '', path: '', parentFolderId: null, depth: 0 }]
  const seen = new Set<string>([rootFolderId])
  let skippedExcluded = 0

  while (queue.length > 0) {
    const current = queue.shift() as QueueEntry
    const node: ArchiveFolderNode = {
      folderId: current.folderId,
      name: current.name,
      path: current.path,
      parentFolderId: current.parentFolderId,
      depth: current.depth,
      files: [],
      twinFolders: [],
      index: null,
      bericht: null,
      bearbeitungsstand: null,
      bearbeitungsstandSeit: null,
    }
    folders.push(node)

    let items: StorageItem[]
    try {
      items = await provider.listItemsById(current.folderId)
    } catch (error) {
      node.error = error instanceof Error ? error.message : String(error)
      continue
    }

    const fileNames = new Set(items.filter((it) => it.type === 'file').map((it) => it.metadata.name))
    for (const item of items) {
      const path = current.path ? `${current.path}/${item.metadata.name}` : item.metadata.name
      if (isExcludedPath(path, exclude)) {
        skippedExcluded++
        continue
      }
      if (item.type === 'folder') {
        if (isShadowTwinFolderName(item.metadata.name)) {
          node.twinFolders.push(await collectTwinFolder(provider, item, path, fileNames, node))
          continue
        }
        if (folders.length + queue.length >= maxFolders) {
          node.error = `Ordner-Limit ${maxFolders} erreicht — Teilbaum ${path} nicht gescannt`
          continue
        }
        if (seen.has(item.id)) continue
        seen.add(item.id)
        queue.push({ folderId: item.id, name: item.metadata.name, path, parentFolderId: current.folderId, depth: current.depth + 1 })
        continue
      }
      node.files.push(toFileEntry(item, path))
      if (item.metadata.name === INDEX_FILE_NAME || item.metadata.name === BERICHT_FILE_NAME) {
        try {
          const doc = await readDoc(provider, item, path)
          if (item.metadata.name === INDEX_FILE_NAME) node.index = doc
          else node.bericht = doc
        } catch (error) {
          node.error = `${item.metadata.name} nicht lesbar: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }

    if (node.index) {
      const stand = readBearbeitungsstand(node.index.meta)
      node.bearbeitungsstand = stand.bearbeitungsstand
      node.bearbeitungsstandSeit = stand.bearbeitungsstandSeit
      if (stand.error) node.error = node.error ? `${node.error}; ${stand.error}` : stand.error
    }
  }

  return { folders, skippedExcluded }
}

/** Erfasst einen `_`-Twin-Ordner, ohne ihn als Archiv-Ordner zu behandeln. */
async function collectTwinFolder(
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
