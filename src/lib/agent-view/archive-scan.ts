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

import { collectTwinFolder, readDoc, toFileEntry } from './archive-scan-readers'
import { compileExcludeGlobs, isExcludedPath } from '@/lib/shadow-twin/sync-engine/scan-exclude'
import { isShadowTwinFolderName } from '@ks/util'
import type { StorageItem } from '@/lib/storage/types'
import { readBearbeitungsstand } from './bearbeitungsstand'
import type { ArchiveFolderNode, ArchiveScanResult } from './archive-types'

/** Minimal-Port auf den Storage (nur Lesen) — haelt den Scan testbar. */
export interface ArchiveScanProvider {
  listItemsById(folderId: string): Promise<StorageItem[]>
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }>
}

export const INDEX_FILE_NAME = '_INDEX.md'
export const BERICHT_FILE_NAME = 'BERICHT.md'

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
  /**
   * Tiefenbegrenzung (Wunschliste 2, W1): Berichte liegen auf Ebene 2-3
   * (Bereich/Projekt bzw. Bereich/Jahrgang/Projekt) — tiefer liegen die
   * Ereignisordner mit Tausenden Dateien, die fuer Sichten irrelevant sind.
   * Unterordner jenseits der Tiefe werden nicht betreten (kein Fehler).
   */
  maxDepth?: number
  /**
   * Parallele Ordner-Listings je Stapel (W1-Befund: 369 Ordner seriell = 80 s
   * auf OneDrive). Default 1 = exakt das bisherige serielle Verhalten; der
   * Provider behandelt 429/Retry-After selbst. Bei concurrency > 1 ist die
   * Reihenfolge von `folders` antwortzeitabhaengig — Konsumenten sortieren
   * (der Coverage-Scan tut das seit W8 und faehrt mit
   * `COVERAGE_SCAN_CONCURRENCY`; der Report bleibt reproduzierbar).
   */
  concurrency?: number
  /**
   * W1: Praedikat, unter welchen Ordnern NICHT weiter abgestiegen wird —
   * z. B. unter Projektordnern (BERICHT.md vorhanden oder Name passt auf das
   * konfigurierte Vorhaben-Muster): dort liegen keine Projekte mehr, nur
   * datierte Ereignisordner. Spart beim Berichte-Lauf genau die Listings, die
   * nichts beitragen. Der Coverage-Scan setzt es nicht (dort zaehlt jede Datei).
   */
  stopDescent?: (node: ArchiveFolderNode) => boolean
  /**
   * Welche Contract-Dateien gelesen werden: 'alle' (Default, Coverage) oder
   * 'nur-bericht' (W1-Sichten: _INDEX.md-Reads sind dort reine Kosten —
   * je Ordner zwei API-Calls, bei 332 Ordnern der Loewenanteil der Laufzeit).
   */
  docs?: 'alle' | 'nur-bericht'
}): Promise<ArchiveScanResult> {
  const { provider, rootFolderId, maxFolders = 5000, maxDepth = Number.POSITIVE_INFINITY } = args
  const concurrency = Math.max(1, Math.floor(args.concurrency ?? 1))
  const exclude = compileExcludeGlobs(args.excludeGlobs)
  const folders: ArchiveFolderNode[] = []
  const queue: QueueEntry[] = [{ folderId: rootFolderId, name: '', path: '', parentFolderId: null, depth: 0 }]
  const seen = new Set<string>([rootFolderId])
  let skippedExcluded = 0

  /** Einen Ordner listen/lesen; liefert die Kinder-Eintraege (noch nicht in der Queue). */
  const scanFolder = async (current: QueueEntry, node: ArchiveFolderNode): Promise<QueueEntry[]> => {
    const children: QueueEntry[] = []
    let items: StorageItem[]
    try {
      items = await provider.listItemsById(current.folderId)
    } catch (error) {
      node.error = error instanceof Error ? error.message : String(error)
      return children
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
        if (folders.length + queue.length + children.length >= maxFolders) {
          node.error = `Ordner-Limit ${maxFolders} erreicht — Teilbaum ${path} nicht gescannt`
          continue
        }
        if (seen.has(item.id)) continue
        seen.add(item.id)
        if (current.depth + 1 > maxDepth) continue // Tiefengrenze: Unterordner bewusst nicht betreten
        children.push({ folderId: item.id, name: item.metadata.name, path, parentFolderId: current.folderId, depth: current.depth + 1 })
        continue
      }
      node.files.push(toFileEntry(item, path))
      const isIndex = item.metadata.name === INDEX_FILE_NAME
      if ((isIndex && args.docs !== 'nur-bericht') || item.metadata.name === BERICHT_FILE_NAME) {
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
    // Prune (stopDescent): unter einem Projektordner liegen keine Projekte mehr.
    if (args.stopDescent?.(node) === true) return []
    return children
  }

  const makeNode = (current: QueueEntry): ArchiveFolderNode => ({
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
  })

  // Worker-Pool: bis zu `concurrency` Ordner gleichzeitig in Arbeit, ohne
  // Rundenschranke (ein Stapel wartete sonst auf seinen langsamsten Ordner).
  // Bei concurrency 1 exakt der bisherige serielle BFS; bei > 1 haengt die
  // Reihenfolge von `folders` von der Antwortzeit ab — Konsumenten sortieren.
  await new Promise<void>((resolve, reject) => {
    let active = 0
    const pump = (): void => {
      while (active < concurrency && queue.length > 0) {
        const current = queue.shift() as QueueEntry
        const node = makeNode(current)
        folders.push(node)
        active += 1
        scanFolder(current, node).then(
          (children) => {
            queue.push(...children)
            active -= 1
            pump()
          },
          reject,
        )
      }
      if (active === 0 && queue.length === 0) resolve()
    }
    pump()
  })

  return { folders, skippedExcluded }
}
