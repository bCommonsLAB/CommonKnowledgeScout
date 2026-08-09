/**
 * @fileoverview Quellen-Aufloesung der Sync-Engine (Scope → Quell-Paare).
 *
 * @description
 * Aus run-library-sync.ts extrahiert und fuer Welle 5a erweitert:
 * - `sourceIds`: Mongo-getrieben (per-Datei-Aufrufe); ohne Doc → uebersprungen
 *   (per-Datei-Adoption kommt mit Welle 5b).
 * - `folderId`: Storage-getriebener Scan; Dateien OHNE Mongo-Doc werden nicht
 *   mehr verworfen, sondern als Adoptions-Kandidaten (doc=null) geliefert.
 * - Ganze Library: Root-Scan (storage-getrieben, wie folderId='root') VEREINT
 *   mit allen Mongo-Dokumenten, deren Quelldatei der Scan nicht fand (z.B.
 *   Datei geloescht) — damit ist der Library-Check storage-VOLLSTAENDIG.
 *
 * Markdown-Dateien, die als Artefakt einer Geschwister-Datei parsen (Sibling-
 * Layout: `X.md` neben `X.pdf`), sind KEINE eigenen Adoptions-Kandidaten —
 * sie werden ueber ihre Quelle adoptiert.
 *
 * @module shadow-twin/sync-engine
 */

import { getAllShadowTwins, getShadowTwinsBySourceIds, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin-folder-name'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { FolderCache } from './folder-cache'

export interface LibrarySyncScope {
  /** Teilmenge konkreter Quellen (per-Datei-Aufrufe der Archiv-UI). */
  sourceIds?: string[]
  /** Storage-getriebener Scan ab diesem Ordner (Explorer, Settings-Pruefen). */
  folderId?: string
  recursive?: boolean
}

/** Quell-Paar: doc=null ⇒ Storage-only-Quelle (Adoptions-Kandidat, Welle 5a). */
export interface SourcePair {
  doc: ShadowTwinDocument | null
  sourceItem: StorageItem | null
}

const DOC_BATCH_SIZE = 100

/** True, wenn die Markdown-Datei als Artefakt einer ANDEREN Datei im selben Ordner parst. */
function isArtifactOfSibling(file: StorageItem, siblings: StorageItem[]): boolean {
  if (!file.metadata.name.toLowerCase().endsWith('.md')) return false
  for (const other of siblings) {
    if (other.type !== 'file' || other.id === file.id) continue
    const base = other.metadata.name.replace(/\.[^.]+$/, '')
    if (!base || !file.metadata.name.startsWith(`${base}.`)) continue
    if (parseArtifactName(file.metadata.name, base).kind) return true
  }
  return false
}

/** Quellen-Liste aufloesen: [doc | null, ggf. Quell-Item aus dem Scan]. */
export async function resolveSources(args: {
  libraryId: string
  scope: LibrarySyncScope
  folderCache: FolderCache
  provider: StorageProvider
}): Promise<{ pairs: SourcePair[]; scannedFiles?: number; skippedWithoutDoc: number }> {
  const { libraryId, scope, folderCache, provider } = args

  if (scope.sourceIds?.length) {
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: scope.sourceIds })
    const pairs: SourcePair[] = []
    for (const sourceId of scope.sourceIds) {
      const doc = docs.get(sourceId)
      if (!doc) continue
      let sourceItem: StorageItem | null = null
      try {
        sourceItem = await provider.getItemById(sourceId)
      } catch {
        // Quelle nicht (mehr) aufloesbar → needs-pipeline entfaellt, Plan laeuft trotzdem.
      }
      pairs.push({ doc, sourceItem })
    }
    return { pairs, skippedWithoutDoc: scope.sourceIds.length - pairs.length }
  }

  // Storage-getrieben: Dateien rekursiv sammeln, Twin-Ordner NICHT als Quellen scannen.
  // Ohne folderId (ganze Library) beginnt der Scan an der Wurzel.
  const files: StorageItem[] = []
  const queue: string[] = [scope.folderId ?? 'root']
  while (queue.length > 0) {
    const current = queue.shift() as string
    const items = await folderCache.list(current)
    const folderFiles = items.filter((it) => it.type === 'file')
    for (const item of items) {
      if (item.type === 'folder') {
        if (scope.recursive !== false && !isShadowTwinFolderName(item.metadata.name)) queue.push(item.id)
        continue
      }
      // Sibling-Artefakte sind keine eigenen Quellen (sie haengen an ihrer Quelle).
      if (isArtifactOfSibling(item, folderFiles)) continue
      files.push(item)
    }
  }

  const pairs: SourcePair[] = []
  for (let i = 0; i < files.length; i += DOC_BATCH_SIZE) {
    const batch = files.slice(i, i + DOC_BATCH_SIZE)
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: batch.map((f) => f.id) })
    for (const file of batch) {
      pairs.push({ doc: docs.get(file.id) ?? null, sourceItem: file })
    }
  }

  // Ganze Library: Mongo-Dokumente ergaenzen, deren Quelldatei der Scan nicht
  // fand (erfasst auch Quellen, deren Datei weg ist — wie bisher Mongo-getrieben).
  if (!scope.folderId) {
    const scanned = new Set(files.map((f) => f.id))
    for (const doc of await getAllShadowTwins(libraryId)) {
      if (!scanned.has(doc.sourceId)) pairs.push({ doc, sourceItem: null })
    }
  }

  // skippedWithoutDoc zaehlt der Orchestrator: erst nach der Artefakt-Suche ist
  // klar, ob eine doc-lose Datei adoptierbar ist oder wirklich nichts traegt.
  return { pairs, scannedFiles: files.length, skippedWithoutDoc: 0 }
}
