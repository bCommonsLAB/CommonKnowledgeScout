/**
 * @fileoverview Quelldateien einer Sammeldatei im Storage finden — auch ueber
 * Ordnergrenzen hinweg.
 *
 * Bisher mussten alle `_source_files` im selben Ordner liegen wie die
 * Sammeldatei (Abgleich per Dateiname unter `parentId`). Die Karten- und
 * Methoden-Markdowns der Commoning-Mustersprache liegen aber eine Ebene ueber
 * ihren Artefakten (`pdfs-pngs/musterkarten pdf/…`, `audios/…`). Eintraege mit
 * Ordner-Segmenten (`relativePath`) werden deshalb als Pfad aufgeloest:
 * zuerst relativ zum Ordner der Sammeldatei, sonst relativ zur Library-Wurzel
 * (Obsidian-Vault-Schreibweise). Jeder Ordner wird pro Lauf nur einmal gelistet.
 */

import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import type { ParsedCompositeSourceEntry } from './composite-source-entry'

export interface CompositeSourceItem {
  id: string
  name: string
  /** Ordner, in dem die Quelle tatsaechlich liegt (fuer Twin-Ordner und Medien). */
  parentId: string
}

/**
 * Loest alle Eintraege auf. Rueckgabe: je `raw`-Eintrag das gefundene Item;
 * nicht gefundene Eintraege fehlen in der Map — der Aufrufer meldet sie als
 * `unresolvedSources`, nichts wird stillschweigend ersetzt.
 */
export async function findCompositeSourceItems(
  provider: StorageProvider,
  parentId: string,
  entries: ParsedCompositeSourceEntry[],
): Promise<Map<string, CompositeSourceItem>> {
  const listings = new Map<string, Promise<StorageItem[]>>()
  const list = (folderId: string): Promise<StorageItem[]> => {
    let pending = listings.get(folderId)
    if (!pending) {
      pending = provider.listItemsById(folderId)
      listings.set(folderId, pending)
    }
    return pending
  }

  const found = new Map<string, CompositeSourceItem>()
  for (const entry of entries) {
    const item = entry.relativePath
      ? (await findByPath(list, parentId, entry.relativePath)) ??
        (await findByPath(list, 'root', entry.relativePath))
      : await findFileInFolder(list, parentId, entry.name)
    if (item) found.set(entry.raw, item)
  }
  return found
}

async function findByPath(
  list: (folderId: string) => Promise<StorageItem[]>,
  startFolderId: string,
  relativePath: string,
): Promise<CompositeSourceItem | null> {
  const segments = relativePath.split('/')
  const fileName = segments[segments.length - 1]
  let folderId = startFolderId
  for (const folderName of segments.slice(0, -1)) {
    const items = await list(folderId)
    const folder = items.find((it) => it.type === 'folder' && it.metadata.name === folderName)
    if (!folder) return null
    folderId = folder.id
  }
  return findFileInFolder(list, folderId, fileName)
}

async function findFileInFolder(
  list: (folderId: string) => Promise<StorageItem[]>,
  folderId: string,
  fileName: string,
): Promise<CompositeSourceItem | null> {
  const items = await list(folderId)
  const match = items.find((it) => it.type === 'file' && it.metadata.name === fileName)
  return match ? { id: match.id, name: fileName, parentId: folderId } : null
}
