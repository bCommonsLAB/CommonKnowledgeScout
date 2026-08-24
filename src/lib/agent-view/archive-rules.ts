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
  /**
   * Ist dieser Ordner die BIBLIOTHEKS-Wurzel? Die ist per Konvention kein
   * Vorhaben und braucht keinen BERICHT (Entscheid Peter, 2026-08-19) — ihr
   * `bearbeitungsstand` beschreibt das Gesamtarchiv, nicht ein Projekt.
   * Bei Teilbaum-Scans ist die Scan-Wurzel ein normaler Ordner (false).
   */
  isLibraryRoot: boolean
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
export function checkReportMissing(
  folder: ArchiveFolderNode,
  pattern: RegExp | null,
  isLibraryRoot = false,
): CoverageGap | null {
  // Die Bibliotheks-Wurzel ist kein Vorhaben — kein BERICHT noetig
  // (siehe ArchiveRuleContext.isLibraryRoot).
  if (isLibraryRoot) return null
  if (!isVorhaben(folder, pattern)) return null
  if (folder.bericht !== null) return null
  // `ungesichtet` ist per Definition noch nicht berichtet — das faengt der
  // Sammel-Gap ab (Gap-Budget), nicht diese Regel.
  if (folder.bearbeitungsstand === 'ungesichtet') return null
  return createGap({
    ...gapBase(folder),
    type: 'report_missing',
    message: `Zu diesem Vorhaben gibt es keinen Bericht (${BERICHT_FILE_NAME} fehlt)`,
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
    message: `Dieser Ordner beschreibt nicht, was in ihm liegt (${INDEX_FILE_NAME} fehlt)`,
    detail: requiredByPattern ? 'Vorhabensordner (Muster)' : `Strukturebene bis Tiefe ${String(indexRequiredMaxDepth)}`,
  })
}

/**
 * Kern von `bericht_veraltet`, entkoppelt vom Scan-Ordnerknoten: der W8-Merge
 * bewertet die Regel fuer ALLE Baumknoten neu (die Teilbaum-Aenderung wandert
 * ueber Vorfahren hinweg) — EINE Regel, zwei Aufrufer, kein Drift.
 */
export function berichtVeraltetGap(args: {
  folderId: string
  path: string
  berichtFileId: string
  berichtModifiedAt: string | null
  newestChangeInSubtree: string | null
  berichtFreshness: boolean
}): CoverageGap | null {
  if (!args.berichtFreshness) return null
  if (args.berichtModifiedAt === null || args.newestChangeInSubtree === null) return null
  if (Date.parse(args.newestChangeInSubtree) <= Date.parse(args.berichtModifiedAt)) return null
  return createGap({
    scope: 'folder',
    folderId: args.folderId,
    path: args.path,
    type: 'bericht_veraltet',
    targetName: BERICHT_FILE_NAME,
    targetId: args.berichtFileId,
    message: `${BERICHT_FILE_NAME} ist aelter als die juengste Aenderung im Vorhaben`,
    detail: `Bericht ${args.berichtModifiedAt}, juengste Aenderung ${args.newestChangeInSubtree}`,
  })
}

/** `bericht_veraltet`: `BERICHT.md` aelter als die juengste Aenderung im Vorhaben. */
export function checkBerichtVeraltet(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap | null {
  const bericht = folder.bericht
  if (bericht === null) return null
  return berichtVeraltetGap({
    folderId: folder.folderId,
    path: folder.path,
    berichtFileId: bericht.fileId,
    berichtModifiedAt: bericht.modifiedAt,
    newestChangeInSubtree: ctx.newestChangeInSubtree,
    berichtFreshness: ctx.conventions.berichtFreshness,
  })
}

/** `scan_error`: isolierter Teilbaum-Fehler wird ausgewiesen, nie verschluckt. */
export function checkScanError(folder: ArchiveFolderNode): CoverageGap | null {
  if (!folder.error) return null
  return createGap({
    ...gapBase(folder),
    type: 'scan_error',
    message: 'Dieser Ordner liess sich nicht vollstaendig lesen — die Zahlen darunter sind unvollstaendig',
    detail: folder.error,
  })
}

/** Alle Archiv-Regeln fuer EINEN Ordner (Registry-Aufruf). */
export function evaluateArchiveRules(folder: ArchiveFolderNode, ctx: ArchiveRuleContext): CoverageGap[] {
  const pattern = ctx.vorhabenPattern
  const gaps = [
    checkScanError(folder),
    checkIndexMissing(folder, pattern, ctx.conventions.indexRequiredMaxDepth),
    checkReportMissing(folder, pattern, ctx.isLibraryRoot),
    checkBerichtVeraltet(folder, ctx),
  ]
  return gaps.filter((gap): gap is CoverageGap => gap !== null)
}
