/**
 * @fileoverview Abhaengigkeit Sammeldatei → Quellen am Twin-Dokument (Welle E).
 *
 * @description
 * Owner-Entscheidung 08.10.2026: Der Transformations-Job schreibt beim
 * Aufloesen von `_source_files` die Storage-Ids der Quellen an das
 * Twin-Dokument der Sammeldatei (`compositeSources`). Vorher stand die
 * Abhaengigkeit nur im Frontmatter der Markdown-Datei im Storage — „welche
 * Sammeldateien enthalten diese Quelle?" waere ein Vollscan gewesen.
 * Eigene Datei neben `shadow-twin-repo.ts` (200-Zeilen-Regel).
 *
 * @module repositories
 */

import { getShadowTwinCollection, ensureShadowTwinIndexes, type ShadowTwinDocument } from './shadow-twin-repo'

/**
 * Vermerkt die Quellen einer Sammeldatei. Upsert: Laeuft der Loader vor dem
 * ersten Artefakt, entsteht ein Dokument ohne Artefakte, das der folgende
 * Artefakt-Upsert fuellt. `updatedAt` wird gesetzt wie bei jedem Schreibweg.
 */
export async function setzeSammeldateiQuellen(args: {
  libraryId: string
  userEmail: string
  sourceId: string
  sourceName: string
  parentId: string
  quellenIds: readonly string[]
}): Promise<void> {
  if (!args.sourceId) throw new Error('setzeSammeldateiQuellen: sourceId fehlt')
  await ensureShadowTwinIndexes(args.libraryId)
  const col = await getShadowTwinCollection(args.libraryId)
  const now = new Date().toISOString()
  await col.updateOne(
    { libraryId: args.libraryId, sourceId: args.sourceId },
    {
      $set: {
        libraryId: args.libraryId, userEmail: args.userEmail, sourceId: args.sourceId,
        sourceName: args.sourceName, parentId: args.parentId, updatedAt: now,
        compositeSources: [...new Set(args.quellenIds)],
      },
      $setOnInsert: { createdAt: now, artifacts: {}, filesystemSync: { enabled: false, shadowTwinFolderId: null, lastSyncedAt: null } },
    },
    { upsert: true },
  )
}

/** Twin-Dokumente aller Sammeldateien, die diese Quelle enthalten — eine indizierte Abfrage. */
export async function findeSammeldateienMitQuelle(libraryId: string, sourceId: string): Promise<ShadowTwinDocument[]> {
  if (!sourceId) throw new Error('findeSammeldateienMitQuelle: sourceId fehlt')
  const col = await getShadowTwinCollection(libraryId)
  return col.find({ libraryId, compositeSources: sourceId }).sort({ sourceName: 1 }).toArray()
}
