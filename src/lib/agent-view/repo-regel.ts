/**
 * @fileoverview Regel `repo_veraltet` (Wunschliste 5, C1) — pur.
 *
 * @description
 * Das Gegenstueck zu `postfach_veraltet` fuer Code: Ein Vorhaben mit
 * `repo:`-Feld sagt per `repo_stand_am`, bis wann seine Aussagen gegen das
 * Repo geprueft sind; der Scan meldet, wenn das laenger her ist als die
 * konfigurierte Schwelle — oder wenn das Feld fehlt bzw. unlesbar ist.
 * Ohne Schwelle ist die Regel inaktiv (Archiv-Konvention, kein
 * Plattform-Wissen); Vorhaben ohne `repo:` merken nichts.
 *
 * Aufloesung: die Aussagen gegen den aktuellen Stand pruefen und
 * `repo_stand_am` (und `repo_stand`) nachziehen.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME } from './archive-scan'
import type { ArchiveFolderNode } from './archive-types'
import type { ArchiveRuleContext } from './archive-rules'
import { createGap } from './gap-registry'
import { istRepoImRueckstand, leseRepoStand, repoStandLabel } from './repo-frische'
import { asList, asString } from './sichten/bericht-lesen'
import type { CoverageGap } from './types'

/** `repo_veraltet`: Der Pruefstand des Berichts gegen sein Repo fehlt oder ist zu alt. */
export function checkRepoVeraltet(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap | null {
  const maxTage = ctx.conventions.repoMaxRueckstandTage
  if (maxTage === null) return null
  const bericht = folder.bericht
  if (bericht === null) return null
  const stand = leseRepoStand(
    {
      repo: asList(bericht.meta.repo),
      repoStandAm: asString(bericht.meta.repo_stand_am),
      repoStand: asString(bericht.meta.repo_stand),
    },
    new Date(ctx.now),
  )
  if (stand.art === 'ohne_repo') return null
  if (stand.art === 'gelesen' && stand.rueckstandTage >= 0 && !istRepoImRueckstand(stand, maxTage)) return null
  return createGap({
    scope: 'folder',
    folderId: folder.folderId,
    path: folder.path,
    type: 'repo_veraltet',
    targetId: bericht.fileId,
    targetName: BERICHT_FILE_NAME,
    message: repoStandLabel(stand),
    detail: `Schwelle ${maxTage} Tage; Repo: ${stand.repos.join(', ')}`,
  })
}
