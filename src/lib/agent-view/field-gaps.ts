/**
 * @fileoverview Uebersetzung der Library-Verifikation A1 in Coverage-Befunde.
 *
 * @description
 * Die Feld-Pruefung selbst bleibt vollstaendig bei A1 (`library-verification/`)
 * — hier wird ihr Ergebnis nur in das Lueckenmodell uebersetzt (Leitprinzip 1,
 * wie `engine-gaps.ts` fuer die Sync-Engine). Uebernommen wird AUSSCHLIESSLICH
 * `missing-base-field` (F2: „A0-Pflichtfelder fehlen"); alle weiteren
 * A1-Befund-Codes (DetailViewType, Facetten, Normalisierung) behalten ihre
 * eigene Route und UI.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { DocumentVerificationResult } from '@/lib/library-verification/types'
import type { SourceLocation } from './engine-gaps'
import { createGap } from './gap-registry'
import type { CoverageGap } from './types'

/**
 * Uebersetzt die Befund-Dokumente eines A1-Laufs. `fileId` ist die
 * Storage-Datei-Id des Meta-Dokuments — dieselbe Id, die der Archiv-Scan
 * liefert; unauffindbare Dokumente haengen an der Wurzel.
 */
export function gapsFromFieldVerification(args: {
  documents: readonly DocumentVerificationResult[]
  locations: ReadonlyMap<string, SourceLocation>
  rootFolderId: string
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const doc of args.documents) {
    const missingFields = doc.issues
      .filter((issue) => issue.code === 'missing-base-field')
      .map((issue) => issue.field ?? '(unbenannt)')
    if (missingFields.length === 0) continue
    const where = args.locations.get(doc.fileId) ?? { folderId: args.rootFolderId, path: doc.fileName ?? doc.fileId }
    gaps.push(
      createGap({
        type: 'core_fields_missing',
        scope: 'source',
        targetId: doc.fileId,
        targetName: doc.fileName ?? doc.fileId,
        folderId: where.folderId,
        path: where.path,
        message: `A0-Pflichtfelder fehlen (${missingFields.length})`,
        detail: missingFields.sort((a, b) => a.localeCompare(b)).join(', '),
      }),
    )
  }
  return gaps
}
