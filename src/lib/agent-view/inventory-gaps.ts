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
 * **Welle W12 (Cowork-Befund 02.09.2026).** Genau diese Aussetzung hat 15
 * Faelle verschluckt: Die Sitzung arbeitet Teilbaum fuer Teilbaum, also lief
 * Form 2 nie. Der Scan meldete die Quellen als „noch nicht erschlossen" —
 * behebbar —, und erst zwoelf gleichzeitig scheiternde Jobs brachten heraus,
 * dass die Dateien gar nicht mehr da sind.
 *
 * Ein Teil dieser Faelle ist aber auch im Teilbaum EINDEUTIG, und das ist der
 * Unterschied, den {@link quellenVerschwunden} nutzt: Wenn der in MongoDB
 * aufgeschriebene ELTERNORDNER der Familie gescannt wurde und die Datei
 * trotzdem nicht auftauchte, liegt sie nicht „womoeglich woanders" — sie ist
 * weg. Diese Familien bekommen den staerkeren Befund `quelle_verschwunden`
 * (Fehler, Mensch) statt `orphan_twin` (Warnung), und zwar in BEIDEN Scopes.
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
          message: `Auswertungen ohne ihr Original: „${twin.expectedSourceName}" fehlt`,
          detail: twin.artifactNames.length > 0 ? `Artefakte: ${twin.artifactNames.join(', ')}` : 'Ordner ist leer',
        }),
      )
    }
  }
  return gaps
}

/**
 * W12: Die Quelle ist beweisbar weg — ihr eigener Ordner wurde gelesen.
 *
 * Die Gegenrichtung des Verweis-Audits: Nicht „ein Dokument zeigt ins Leere",
 * sondern „die Datenbank verspricht eine Quelle, die es nicht gibt". Kein Job
 * behebt das, deshalb Fehler und Akteur Mensch — ein erneutes Erschliessen
 * scheitert am fehlenden Original, und genau das ist am 02.09. zwoelfmal
 * passiert.
 */
export function quellenVerschwunden(args: {
  families: readonly TwinFamilyView[]
  scannedFileIds: ReadonlySet<string>
  scannedFolderIds: ReadonlySet<string>
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const family of args.families) {
    if (!istVerschwunden(family, args.scannedFileIds, args.scannedFolderIds)) continue
    gaps.push(
      createGap({
        type: 'quelle_verschwunden',
        scope: 'source',
        targetId: family.sourceId,
        targetName: family.sourceName,
        folderId: family.parentId,
        path: family.path || family.sourceName,
        message: 'Die Datenbank kennt diese Quelle, im Speicher liegt sie nicht mehr',
        detail:
          `${family.artifacts.length} Artefakt(e) in MongoDB; der Ordner wurde gelesen, ` +
          'die Datei war nicht darin',
      }),
    )
  }
  return gaps
}

/** Beweisbar weg = Artefakte da, Datei nicht gefunden, Elternordner gelesen. */
export function istVerschwunden(
  family: TwinFamilyView,
  scannedFileIds: ReadonlySet<string>,
  scannedFolderIds: ReadonlySet<string>,
): boolean {
  if (family.artifacts.length === 0) return false
  if (scannedFileIds.has(family.sourceId)) return false
  return scannedFolderIds.has(family.parentId)
}

/**
 * Form 2: Twin-Dokument in MongoDB, dessen Quelle der Scan nicht fand.
 *
 * Faelle, die {@link quellenVerschwunden} bereits staerker benennt, bleiben
 * hier aussen vor — sonst stuende dieselbe Tatsache zweimal im Report.
 */
export function orphanTwinDocuments(args: {
  families: readonly TwinFamilyView[]
  scannedFileIds: ReadonlySet<string>
  scannedFolderIds: ReadonlySet<string>
  rootFolderId: string
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const family of args.families) {
    if (args.scannedFileIds.has(family.sourceId)) continue
    if (family.artifacts.length === 0) continue
    if (istVerschwunden(family, args.scannedFileIds, args.scannedFolderIds)) continue
    gaps.push(
      createGap({
        type: 'orphan_twin',
        scope: 'source',
        targetId: family.sourceId,
        targetName: family.sourceName,
        folderId: args.rootFolderId,
        path: family.path || family.sourceName,
        message: 'Auswertung vorhanden, aber das Original liegt nicht (mehr) im Archiv',
        detail: `${family.artifacts.length} Artefakt(e) in MongoDB`,
      }),
    )
  }
  return gaps
}
