/**
 * @fileoverview Schnappschuss eines Library-Speichers: jede Storage-Id mit ihrem Pfad.
 *
 * @description
 * Grundlage fuer das Umschreiben der Storage-Ids nach einem Speicherwechsel
 * (z. B. OneDrive → Nextcloud): Vor dem Umhaengen wird der alte Speicher
 * gelesen (alte Id → Pfad), danach der neue (Pfad → neue Id). Die Zuordnung
 * laeuft ueber den library-relativen Pfad, nicht ueber Provider-Wissen —
 * dadurch gilt sie fuer jede Richtung. Zugriff nur ueber das
 * StorageProvider-Interface (storage-abstraction).
 *
 * @module storage-remap
 */

import type { StorageProvider } from '@/lib/storage/types'

export interface SnapshotEntry {
  id: string
  parentId: string
  /** Library-relativer Pfad ohne fuehrenden Schraegstrich, z. B. "Ordner/Datei.mp3". */
  relPath: string
  type: 'file' | 'folder'
}

export interface StorageSnapshot {
  libraryId: string
  createdAt: string
  storageType: string
  /**
   * Ids, unter denen der Speicher die Library-Wurzel als parentId meldet.
   * Nextcloud meldet "root", OneDrive die Id des Basisordners.
   */
  rootParentIds: string[]
  entries: SnapshotEntry[]
}

/** Liest den Speicher vollstaendig (Breitensuche ab der Wurzel). */
export async function collectSnapshot(args: {
  provider: StorageProvider
  libraryId: string
  storageType: string
  onFolder?: (relPath: string, count: number) => void
}): Promise<StorageSnapshot> {
  const { provider, libraryId, storageType, onFolder } = args
  const entries: SnapshotEntry[] = []
  const rootParentIds = new Set<string>(['root'])
  const queue: Array<{ id: string; relPath: string }> = [{ id: 'root', relPath: '' }]
  let folders = 0

  while (queue.length > 0) {
    const folder = queue.shift() as { id: string; relPath: string }
    const items = await provider.listItemsById(folder.id)
    folders++
    onFolder?.(folder.relPath || '(Wurzel)', folders)
    for (const item of items) {
      if (folder.id === 'root') rootParentIds.add(item.parentId)
      const name = item.metadata.name
      if (!name) throw new Error(`Schnappschuss: Eintrag ohne Namen in "${folder.relPath || '(Wurzel)'}" (id=${item.id})`)
      const relPath = folder.relPath ? `${folder.relPath}/${name}` : name
      entries.push({ id: item.id, parentId: item.parentId, relPath, type: item.type })
      if (item.type === 'folder') queue.push({ id: item.id, relPath })
    }
  }

  return {
    libraryId,
    createdAt: new Date().toISOString(),
    storageType,
    rootParentIds: [...rootParentIds],
    entries,
  }
}
