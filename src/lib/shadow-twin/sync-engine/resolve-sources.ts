/**
 * @fileoverview Quellen-Aufloesung der Sync-Engine (Scope → Quell-Paare).
 *
 * @description
 * Aus run-library-sync.ts extrahiert und fuer Welle 5a/5b erweitert:
 * - `sourceIds`: per-Datei-Aufrufe; ohne Mongo-Doc wird die Quelldatei aus dem
 *   Storage geladen und als Adoptions-Kandidat (doc=null) geliefert (Welle 5b).
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
import { compileExcludeGlobs, isExcludedPath } from './scan-exclude'
import { isShadowTwinFolderName } from '@ks/util'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { FolderCache } from './folder-cache'
import { listFoldersParallel } from './list-folders-parallel'

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
  /**
   * Relative Pfadlaenge des Quell-Ordners (inkl. Trennzeichen) aus dem Scan —
   * Basis fuer den Pfad-Budget-Check (Welle 5c). undefined = unbekannt
   * (sourceIds-Scope, Mongo-Ergaenzung ohne Scan-Fund).
   */
  parentPathLength?: number
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
  /** Ausschluss-Muster der Library (Welle 0b, `config.scanExcludeGlobs`). */
  excludeGlobs?: readonly string[]
}): Promise<{ pairs: SourcePair[]; scannedFiles?: number; skippedWithoutDoc: number; skippedExcluded: number }> {
  const { libraryId, scope, folderCache, provider } = args
  const exclude = compileExcludeGlobs(args.excludeGlobs)
  let skippedExcluded = 0

  if (scope.sourceIds?.length) {
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: scope.sourceIds })
    const pairs: SourcePair[] = []
    let skippedWithoutDoc = 0
    for (const sourceId of scope.sourceIds) {
      const doc = docs.get(sourceId) ?? null
      let sourceItem: StorageItem | null = null
      try {
        sourceItem = await provider.getItemById(sourceId)
      } catch {
        // Quelle nicht (mehr) aufloesbar → needs-pipeline entfaellt, Plan laeuft trotzdem.
      }
      // Ohne Doc UND ohne Storage-Datei gibt es nichts zu planen; mit Datei wird
      // die Quelle Adoptions-Kandidat (doc=null, Welle 5b — per-Datei-Adoption).
      if (!doc && sourceItem?.type !== 'file') {
        skippedWithoutDoc++
        continue
      }
      // Welle 0g: Artefakt-Dateien sind KEINE eigenen Quellen — sonst erzeugt
      // der Datei-Oeffnen-Abgleich (Lazy-Resolve/auto-sync) Rausch-Twins fuer
      // `X.md` neben `X.pdf` bzw. fuer Dateien im `_`-Twin-Ordner. Der
      // Ordner-Scan filtert das seit jeher; hier zog die Pruefung nie mit.
      if (!doc && sourceItem && sourceItem.metadata.name.toLowerCase().endsWith('.md')) {
        const parentItems = await folderCache.list(sourceItem.parentId)
        const parentFolder = await provider.getItemById(sourceItem.parentId).catch(() => null)
        const inTwinFolder = !!parentFolder && isShadowTwinFolderName(parentFolder.metadata.name)
        if (inTwinFolder || isArtifactOfSibling(sourceItem, parentItems.filter((it) => it.type === 'file'))) {
          skippedWithoutDoc++
          continue
        }
      }
      pairs.push({ doc, sourceItem })
    }
    return { pairs, skippedWithoutDoc, skippedExcluded: 0 }
  }

  // Storage-getrieben: Dateien rekursiv sammeln, Twin-Ordner NICHT als Quellen scannen.
  // Ohne folderId (ganze Library) beginnt der Scan an der Wurzel. Der Scan traegt
  // relative Pfadlaengen mit (Welle 5c, Pfad-Budget) — relativ zur Scan-Wurzel,
  // beim Library-Scope also zur Library-Wurzel.
  const files: StorageItem[] = []
  const rootId = scope.folderId ?? 'root'
  const folderPathLength = new Map<string, number>([[rootId, 0]])
  // Relative Pfade nur fuer den Ausschluss-Abgleich mitfuehren (Wurzel = '').
  const folderRelPath = new Map<string, string>([[rootId, '']])
  const filePathLength = new Map<string, number>()
  // Breitensuche EBENENWEISE: die Ordner einer Ebene werden nebenlaeufig
  // gelistet, danach aber streng in Warteschlangen-Reihenfolge ausgewertet.
  // Damit entsteht Datei fuer Datei dieselbe `files`-Reihenfolge wie bei der
  // frueheren seriellen Schleife (an ihr haengen Plan und Report) — parallel
  // ist nur das Warten auf den Storage. Befund 29.08.2026: seriell brauchte
  // dieser Walk bei 1.129 Ordnern rund vier Minuten und liess den
  // Coverage-Scan an der Zeitgrenze scheitern.
  let ebene: string[] = [rootId]
  while (ebene.length > 0) {
    const listings = await listFoldersParallel({ folderIds: ebene, list: (id) => folderCache.list(id) })
    const naechsteEbene: string[] = []
    for (let i = 0; i < ebene.length; i++) {
      const current = ebene[i]
      const currentPathLength = folderPathLength.get(current) ?? 0
      const currentRelPath = folderRelPath.get(current) ?? ''
      const items = listings[i]
      const folderFiles = items.filter((it) => it.type === 'file')
      for (const item of items) {
        const relPath = currentRelPath ? `${currentRelPath}/${item.metadata.name}` : item.metadata.name
        if (item.type === 'folder') {
          if (scope.recursive !== false && !isShadowTwinFolderName(item.metadata.name)) {
            // Ausschluss-Muster (Welle 0b): Teilbaum ueberspringen, aber ZAEHLEN.
            if (isExcludedPath(relPath, exclude)) {
              skippedExcluded++
              continue
            }
            folderPathLength.set(item.id, currentPathLength + item.metadata.name.length + 1)
            folderRelPath.set(item.id, relPath)
            naechsteEbene.push(item.id)
          }
          continue
        }
        if (isExcludedPath(relPath, exclude)) {
          skippedExcluded++
          continue
        }
        // Sibling-Artefakte sind keine eigenen Quellen (sie haengen an ihrer Quelle).
        if (isArtifactOfSibling(item, folderFiles)) continue
        filePathLength.set(item.id, currentPathLength)
        files.push(item)
      }
    }
    ebene = naechsteEbene
  }

  const pairs: SourcePair[] = []
  for (let i = 0; i < files.length; i += DOC_BATCH_SIZE) {
    const batch = files.slice(i, i + DOC_BATCH_SIZE)
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: batch.map((f) => f.id) })
    for (const file of batch) {
      pairs.push({ doc: docs.get(file.id) ?? null, sourceItem: file, parentPathLength: filePathLength.get(file.id) })
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
  return { pairs, scannedFiles: files.length, skippedWithoutDoc: 0, skippedExcluded }
}
