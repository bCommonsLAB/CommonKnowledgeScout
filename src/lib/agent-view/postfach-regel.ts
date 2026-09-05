/**
 * @fileoverview Regel `postfach_veraltet` (Welle A7b) — pur.
 *
 * @description
 * Eigene Datei statt weiterem Wachstum von `archive-rules.ts`
 * (200-Zeilen-Regel) und weil diese Regel als EINZIGE Archiv-Regel gegen
 * den Kalender misst statt gegen eine zweite Datei: Ein Postfach-Rueckstand
 * waechst, ohne dass sich im Archiv etwas aendert.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME } from './archive-scan'
import type { ArchiveFolderNode } from './archive-types'
import type { ArchiveRuleContext } from './archive-rules'
import { createGap } from './gap-registry'
import { istPostfachImRueckstand, lesePostfachStand, postfachStandLabel } from './postfach-frische'
import { asString } from './sichten/bericht-lesen'
import type { CoverageGap } from './types'

/**
 * `postfach_veraltet`: Die E-Mail-Auswertung des Vorhabens haengt zurueck.
 *
 * Grundlage ist `postfach_bis` im `BERICHT.md` (Korrespondenz-Methode des
 * Archivs, Format `JJJJ-KWnn`). Ohne konfigurierte Schwelle ist die Regel
 * inaktiv — sie ist ARCHIV-Konvention, nicht Plattform-Wissen (F2), und
 * Libraries ohne Postfach-Auswertung duerfen davon nichts merken.
 *
 * Ein UNLESBARES `postfach_bis` erzeugt ebenfalls einen Befund: „Feld da,
 * aber unbrauchbar" ist ein Zustand, kein Nicht-Zustand — still auf „kein
 * Rueckstand" zu schliessen waere der verbotene Fallback.
 */
export function checkPostfachVeraltet(
  folder: ArchiveFolderNode,
  ctx: ArchiveRuleContext,
): CoverageGap | null {
  if (ctx.conventions.postfachMaxRueckstandWochen === null) return null
  const bericht = folder.bericht
  if (bericht === null) return null
  const stand = lesePostfachStand(asString(bericht.meta.postfach_bis), new Date(ctx.now))
  if (stand.art === 'ohne_angabe') return null
  if (stand.art === 'gelesen' && !istPostfachImRueckstand(stand, ctx.conventions.postfachMaxRueckstandWochen)) {
    return null
  }
  const gegenstellen = asString(bericht.meta.korrespondenz)
  return createGap({
    scope: 'folder',
    folderId: folder.folderId,
    path: folder.path,
    type: 'postfach_veraltet',
    targetId: bericht.fileId,
    targetName: BERICHT_FILE_NAME,
    message: postfachStandLabel(stand),
    detail:
      gegenstellen === null
        ? 'Gegenstellen stehen nicht im Frontmatter (korrespondenz:) — ohne sie ist die Suche nicht eingegrenzt'
        : `Gegenstellen: ${gegenstellen}`,
  })
}
