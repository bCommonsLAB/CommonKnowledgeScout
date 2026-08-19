/**
 * @fileoverview Archiv-Konventionsregeln der Agentensicht (reine Funktionen).
 *
 * @description
 * Diese Regeln kann KEINE bestehende Maschine — sie sind der eigene Beitrag
 * der Agentensicht. Wichtig (Projektauftrag F2): Die Ordner-Konventionen sind
 * ARCHIV-Konvention, nicht Plattform-Wissen. Deshalb ist nichts hartkodiert:
 *
 * - Ein Ordner gilt als **Vorhaben**, wenn sein Name auf das konfigurierte
 *   Muster passt ODER er sich per `_INDEX.md`-`bearbeitungsstand` selbst als
 *   Vorhaben deklariert. Ohne beides ist er nur Struktur — und erzeugt keine
 *   Befunde (kein geratenes `JJ.MM`).
 * - `_INDEX.md`-Pflicht gilt nur bis zu einer konfigurierten Tiefe.
 * - `bericht_veraltet` ist abschaltbar.
 *
 * Registry-Form: `(node, ctx) => Gap[]` — erweiterbar ohne Service-Umbau.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import { BERICHT_FILE_NAME, INDEX_FILE_NAME } from './archive-scan'
import { createGap } from './gap-registry'
import type { CoverageGap } from './types'

export interface ArchiveRuleConventions {
  /** Regex-Quelle fuer Vorhabensordner; null = nur Selbstdeklaration. */
  vorhabenFolderPattern: string | null
  /** Bis zu dieser Tiefe ist `_INDEX.md` Pflicht; null = Regel inaktiv. */
  indexRequiredMaxDepth: number | null
  /** `bericht_veraltet` pruefen? */
  berichtFreshness: boolean
}

export interface ArchiveRuleContext {
  conventions: ArchiveRuleConventions
  /** Einmal kompiliertes Vorhaben-Muster (siehe {@link compileVorhabenPattern}). */
  vorhabenPattern: RegExp | null
  /** Juengste Aenderung im Teilbaum (Dateien + Twins) als ISO, null = unbekannt. */
  newestChangeInSubtree: string | null
}

/** Kompiliert das Vorhaben-Muster einmal; ungueltige Regex wirft laut. */
export function compileVorhabenPattern(pattern: string | null): RegExp | null {
  if (pattern === null || pattern.trim() === '') return null
  try {
    return new RegExp(pattern)
  } catch (error) {
    throw new Error(
      `Ungueltiges vorhabenFolderPattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Ist der Ordner ein Vorhaben? Entweder per Library-Muster oder durch
 * Selbstdeklaration (`_INDEX.md` mit `bearbeitungsstand`).
 */
export function isVorhaben(folder: ArchiveFolderNode, pattern: RegExp | null): boolean {
  if (folder.bearbeitungsstand !== null) return true
  if (pattern === null) return false
  return folder.name !== '' && pattern.test(folder.name)
}

function gapBase(folder: ArchiveFolderNode) {
  return {
    scope: 'folder' as const,
    targetId: folder.folderId,
    targetName: folder.name || '(Wurzel)',
    folderId: folder.folderId,
    path: folder.path,
  }
}

/** `report_missing`: Vorhabensordner ohne `BERICHT.md`. */
export function checkReportMissing(folder: ArchiveFolderNode, pattern: RegExp | null): CoverageGap | null {
  if (!isVorhaben(folder, pattern)) return null
  if (folder.bericht !== null) return null
  // `ungesichtet` ist per Definition noch nicht berichtet — das faengt der
  // Sammel-Gap ab (Gap-Budget), nicht diese Regel.
  if (folder.bearbeitungsstand === 'ungesichtet') return null
  return createGap({
    ...gapBase(folder),
    type: 'report_missing',
    message: `Vorhaben ohne ${BERICHT_FILE_NAME}`,
  })
}

/** `index_missing`: Strukturebene bzw. Vorhaben ohne `_INDEX.md`. */
export function checkIndexMissing(
  folder: ArchiveFolderNode,
  pattern: RegExp | null,
  indexRequiredMaxDepth: number | null,
): CoverageGap | null {
  if (folder.index !== null) return null
  const requiredByDepth = indexRequiredMaxDepth !== null && folder.depth <= indexRequiredMaxDepth
  const requiredByPattern = pattern !== null && folder.name !== '' && pattern.test(folder.name)
  if (!requiredByDepth && !requiredByPattern) return null
  return createGap({
    ...gapBase(folder),
    type: 'index_missing',
    message: `Ordner ohne ${INDEX_FILE_NAME}`,
    detail: requiredByPattern ? 'Vorhabensordner (Muster)' : `Strukturebene bis Tiefe ${String(indexRequiredMaxDepth)}`,
  })
}

/** `bericht_veraltet`: `BERICHT.md` aelter als die juengste Aenderung im Vorhaben. */
export function checkBerichtVeraltet(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap | null {
  if (!ctx.conventions.berichtFreshness) return null
  const bericht = folder.bericht
  if (bericht === null || bericht.modifiedAt === null) return null
  if (ctx.newestChangeInSubtree === null) return null
  if (Date.parse(ctx.newestChangeInSubtree) <= Date.parse(bericht.modifiedAt)) return null
  return createGap({
    ...gapBase(folder),
    type: 'bericht_veraltet',
    targetName: bericht.name,
    targetId: bericht.fileId,
    message: `${BERICHT_FILE_NAME} ist aelter als die juengste Aenderung im Vorhaben`,
    detail: `Bericht ${bericht.modifiedAt}, juengste Aenderung ${ctx.newestChangeInSubtree}`,
  })
}

/** `scan_error`: isolierter Teilbaum-Fehler wird ausgewiesen, nie verschluckt. */
export function checkScanError(folder: ArchiveFolderNode): CoverageGap | null {
  if (!folder.error) return null
  return createGap({
    ...gapBase(folder),
    type: 'scan_error',
    message: 'Teilbaum konnte nicht vollstaendig gelesen werden',
    detail: folder.error,
  })
}

/** Alle Archiv-Regeln fuer EINEN Ordner (Registry-Aufruf). */
export function evaluateArchiveRules(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap[] {
  const pattern = ctx.vorhabenPattern
  const gaps = [
    checkScanError(folder),
    checkIndexMissing(folder, pattern, ctx.conventions.indexRequiredMaxDepth),
    checkReportMissing(folder, pattern),
    checkBerichtVeraltet(folder, ctx),
  ]
  return gaps.filter((gap): gap is CoverageGap => gap !== null)
}
