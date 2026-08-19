/**
 * @fileoverview Inventar-Abgleich: verwaiste Twins (Buch 2 gegen Buch 2).
 *
 * @description
 * `orphan_twin` hat zwei Erscheinungsformen (F2):
 * 1. ein `_`-Spiegelordner, dessen Quelldatei im selben Ordner fehlt, und
 * 2. ein Twin-Dokument in MongoDB, dessen Quelle der Storage-Scan nicht fand.
 *
 * Form 2 ist NUR beim Library-weiten Scan aussagekraeftig: Bei einem
 * Ordner-Scope liegt die Quelle womoeglich einfach ausserhalb des Scopes.
 * Statt dort still zu schweigen, meldet der Report die Regel als
 * ausgesetzt (`orphanCheckSkipped`) — kein stiller Fallback.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import { createGap } from './gap-registry'
import type { TwinFamilyView } from './twin-rules'
import type { CoverageGap } from './types'

/** Form 1: `_X.pdf/` ohne `X.pdf` im selben Ordner. */
export function orphanTwinFolders(folders: readonly ArchiveFolderNode[]): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const folder of folders) {
    for (const twin of folder.twinFolders) {
      if (twin.sourcePresent) continue
      gaps.push(
        createGap({
          type: 'orphan_twin',
          scope: 'folder',
          targetId: twin.folderId,
          targetName: twin.name,
          folderId: folder.folderId,
          path: twin.path,
          message: `Spiegelordner ohne Quelldatei „${twin.expectedSourceName}"`,
          detail: twin.artifactNames.length > 0 ? `Artefakte: ${twin.artifactNames.join(', ')}` : 'Ordner ist leer',
        }),
      )
    }
  }
  return gaps
}

/** Form 2: Twin-Dokument in MongoDB, dessen Quelle der Scan nicht fand. */
export function orphanTwinDocuments(args: {
  families: readonly TwinFamilyView[]
  scannedFileIds: ReadonlySet<string>
  rootFolderId: string
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const family of args.families) {
    if (args.scannedFileIds.has(family.sourceId)) continue
    if (family.artifacts.length === 0) continue
    gaps.push(
      createGap({
        type: 'orphan_twin',
        scope: 'source',
        targetId: family.sourceId,
        targetName: family.sourceName,
        folderId: args.rootFolderId,
        path: family.path || family.sourceName,
        message: 'Twin-Dokument ohne Quelldatei im Scan',
        detail: `${family.artifacts.length} Artefakt(e) in MongoDB`,
      }),
    )
  }
  return gaps
}
