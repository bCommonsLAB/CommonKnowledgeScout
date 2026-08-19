/**
 * @fileoverview Verweis-Audit ueber alle Contract-Dokumente eines Scans.
 *
 * @description
 * Fuehrt das Verweis-Audit (`reference-audit.ts`) fuer jedes `_INDEX.md` und
 * jedes `BERICHT.md` des Archiv-Scans aus. `bericht_unvollstaendig` wird nur
 * fuer VORHABEN erhoben — ein reiner Strukturordner soll nicht jede Datei
 * seines Teilbaums aufzaehlen muessen.
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import { isVorhaben } from './archive-rules'
import type { ArchiveFolderNode } from './archive-types'
import { buildInventoryTargets, type FileLocation } from './coverage-inputs'
import { auditReferences, buildReferenceIndex } from './reference-audit'
import type { TwinFamilyView } from './twin-rules'
import type { CoverageGap } from './types'

/** Verweis-Audit fuer alle `BERICHT.md`/`_INDEX.md` des Scans. */
export function auditAllDocuments(args: {
  folders: readonly ArchiveFolderNode[]
  families: readonly TwinFamilyView[]
  fileIndex: ReadonlyMap<string, FileLocation>
  vorhabenPattern: RegExp | null
}): CoverageGap[] {
  const index = buildReferenceIndex(buildInventoryTargets({ folders: args.folders, families: args.families, fileIndex: args.fileIndex }))
  const sourcesByFolder = new Map<string, Array<{ name: string; path: string }>>()
  for (const family of args.families) {
    if (family.artifacts.length === 0) continue
    const bucket = sourcesByFolder.get(family.folderId) ?? []
    bucket.push({ name: family.sourceName, path: family.path || family.sourceName })
    sourcesByFolder.set(family.folderId, bucket)
  }

  const gaps: CoverageGap[] = []
  for (const folder of args.folders) {
    if (folder.index) gaps.push(...auditReferences({ doc: folder.index, folderId: folder.folderId, index }))
    if (!folder.bericht) continue
    gaps.push(
      ...auditReferences({
        doc: folder.bericht,
        folderId: folder.folderId,
        index,
        // `bericht_unvollstaendig` nur fuer Vorhaben — Strukturordner sollen
        // nicht jede Datei ihres Teilbaums aufzaehlen muessen.
        expectedSources: isVorhaben(folder, args.vorhabenPattern) ? sourcesByFolder.get(folder.folderId) ?? [] : [],
      }),
    )
  }
  return gaps
}
