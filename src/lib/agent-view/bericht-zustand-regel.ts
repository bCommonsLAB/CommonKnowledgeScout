/**
 * @fileoverview Regeln `bericht_zu_lang`, `status_zu_lang`, `bericht_ueberholt`
 * (Wunschliste 6, Teil A) — pur.
 *
 * @description
 * Die drei Regeln machen die Trennung „Bericht = Zustand, Notiz/Verlauf =
 * Verlauf" MESSBAR: Solange nichts misst, gewinnt das Anhaengen. Jede Regel
 * ist ohne gesetzte Schwelle inaktiv (Archiv-Konvention, kein
 * Plattform-Wissen — dieselbe Form wie `postfach_veraltet`/`repo_veraltet`).
 *
 * Sie gelten NUR fuer `BERICHT.md`: Dateien mit `type: notiz` oder
 * `type: verlauf` duerfen wachsen (Wunschliste 6, C1) und werden hier gar
 * nicht erst angesehen.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME } from './archive-scan'
import type { ArchiveFolderNode } from './archive-types'
import type { ArchiveRuleContext } from './archive-rules'
import { leseNaechstenTermin, schwelleFuerRolle, statusZeilen, ueberholtePunkte } from './bericht-zustand'
import { createGap } from './gap-registry'
import { asString } from './sichten/bericht-lesen'
import type { CoverageGap } from './types'

function berichtBasis(folder: ArchiveFolderNode, fileId: string) {
  return {
    scope: 'folder' as const,
    folderId: folder.folderId,
    path: folder.path,
    targetId: fileId,
    targetName: BERICHT_FILE_NAME,
  }
}

/** `bericht_zu_lang`: `BERICHT.md` groesser als die Schwelle seiner Rolle. */
export function checkBerichtZuLang(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap | null {
  const bericht = folder.bericht
  if (bericht === null) return null
  const rolle = schwelleFuerRolle(asString(bericht.meta.rolle), ctx.conventions.berichtMaxBytes)
  if (rolle.schwelle === null) return null
  // Groesse unbekannt (Provider nennt keine): nichts messbar — der Scan setzt
  // das Feld sonst immer, siehe `ArchiveFileEntry.sizeBytes`.
  if (typeof bericht.sizeBytes !== 'number') return null
  if (bericht.sizeBytes <= rolle.schwelle) return null
  return createGap({
    ...berichtBasis(folder, bericht.fileId),
    type: 'bericht_zu_lang',
    message: `${BERICHT_FILE_NAME} hat ${String(bericht.sizeBytes)} Byte — die Schwelle liegt bei ${String(rolle.schwelle)}`,
    detail: rolle.rolleUnbekannt
      ? 'rolle: im Frontmatter fehlt oder ist weder anwendung noch plattform — als Anwendung gemessen'
      : `gemessen als rolle: ${rolle.gemessenAls}`,
  })
}

/** `status_zu_lang`: der Abschnitt „## Status" hat mehr Zeilen als die Schwelle. */
export function checkStatusZuLang(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap | null {
  const max = ctx.conventions.statusMaxZeilen
  const bericht = folder.bericht
  if (max === null || bericht === null) return null
  const zeilen = statusZeilen(bericht.body)
  if (zeilen === null || zeilen <= max) return null
  return createGap({
    ...berichtBasis(folder, bericht.fileId),
    type: 'status_zu_lang',
    message: `Der Abschnitt „## Status" hat ${String(zeilen)} Zeilen — vorgesehen sind hoechstens ${String(max)}`,
    detail: 'gezaehlt: nicht-leere Zeilen ausserhalb von Codebloecken (der knowledgescout:-Block zaehlt nicht)',
  })
}

/**
 * `bericht_ueberholt`: offene Punkte mit vergangenem Datum bzw. ein
 * `naechster_termin` in der Vergangenheit. EIN Sammelbefund je Bericht (wie
 * `bericht_unvollstaendig`); das Detail nennt jede Zeile woertlich, damit die
 * Session sie ohne Lesen des ganzen Berichts findet.
 */
export function checkBerichtUeberholt(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap | null {
  const abTagen = ctx.conventions.ueberholtNachTagen
  const bericht = folder.bericht
  if (abTagen === null || bericht === null) return null
  const now = new Date(ctx.now)
  const funde = ueberholtePunkte(bericht.body, now, abTagen).map(
    (punkt) => `„${punkt.zeile}" (seit ${String(punkt.tageVorbei)} Tagen vorbei)`,
  )
  const termin = leseNaechstenTermin(asString(bericht.meta.naechster_termin), now)
  // „Feld da, aber unbrauchbar" ist ein Zustand, kein Nicht-Zustand.
  if (termin.art === 'unlesbar') funde.push(`naechster_termin: ${termin.roh} ist nicht lesbar (erwartet JJJJ-MM-TT)`)
  if (termin.art === 'gelesen' && termin.tageVorbei > 0) {
    funde.push(`naechster_termin: ${termin.roh} liegt ${String(termin.tageVorbei)} Tage zurueck`)
  }
  if (funde.length === 0) return null
  return createGap({
    ...berichtBasis(folder, bericht.fileId),
    type: 'bericht_ueberholt',
    message: `${String(funde.length)} Angabe(n) mit vergangenem Datum stehen noch als offen im Bericht`,
    detail: `${funde.join(' | ')} — Schwelle: ab ${String(abTagen)} Tagen`,
  })
}
