/**
 * @fileoverview Merge-Voraussetzungen (F10, Welle W8) — benannte Fallbacks.
 *
 * @description
 * Prueft VOR dem Merge, ob die Aequivalenz zum Voll-Scan beweisbar ist.
 * Jede nicht mergebare Lage ist ein BENANNTER Grund (kein stilles Raten) —
 * die Route speichert dann den Teil-Report wie vor W8 und sagt warum.
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { CoverageReport, CoverageTreeNode } from './types'

export type MergeFallbackGrund =
  | 'voll_report_ist_teilbaum'
  | 'scope_nicht_im_report'
  | 'report_vor_w8'
  | 'ungesichteter_vorfahr'
  | 'familien_gekappt'
  | 'konventionen_geaendert'

export type MergeErgebnis =
  | { merged: true; report: CoverageReport }
  | { merged: false; grund: MergeFallbackGrund; erklaerung: string }

function fallback(grund: MergeFallbackGrund, erklaerung: string): MergeErgebnis {
  return { merged: false, grund, erklaerung: `${erklaerung} — der Teil-Report ersetzt den gespeicherten (wie vor W8).` }
}

function konventionenGleich(a: CoverageReport['conventions'], b: CoverageReport['conventions']): boolean {
  return (
    a.standardTemplate === b.standardTemplate &&
    a.vorhabenFolderPattern === b.vorhabenFolderPattern &&
    a.indexRequiredMaxDepth === b.indexRequiredMaxDepth &&
    a.berichtFreshness === b.berichtFreshness &&
    a.scanExcludeGlobs.length === b.scanExcludeGlobs.length &&
    a.scanExcludeGlobs.every((glob, idx) => glob === b.scanExcludeGlobs[idx])
  )
}

function hatW8Skalare(nodes: readonly CoverageTreeNode[]): boolean {
  return nodes.every(
    (node) =>
      node.neuesteEigeneAenderung !== undefined &&
      node.berichtFileId !== undefined &&
      hatW8Skalare(node.children),
  )
}

/** Kette Wurzel → … → Knoten der folderId; null = nicht im Baum. */
function findeKette(nodes: readonly CoverageTreeNode[], folderId: string): CoverageTreeNode[] | null {
  for (const node of nodes) {
    if (node.folderId === folderId) return [node]
    const tiefer = findeKette(node.children, folderId)
    if (tiefer) return [node, ...tiefer]
  }
  return null
}

/**
 * Alle Merge-Voraussetzungen in einem Rutsch; bei Erfolg kommt der
 * Scope-Knoten aus dem Voll-Baum zurueck (Pfad-Praefix + Graft-Ziel).
 */
export function pruefeMergeVoraussetzungen(args: {
  voll: CoverageReport
  teil: CoverageReport
  scopeFolderId: string
}): { ok: true; scopeNode: CoverageTreeNode } | { ok: false; ergebnis: MergeErgebnis } {
  const { voll, teil } = args
  if (voll.scope.folderId !== null) {
    return { ok: false, ergebnis: fallback('voll_report_ist_teilbaum', 'Der gespeicherte Report ist selbst ein Teilbaum-Report') }
  }
  if (!konventionenGleich(voll.conventions, teil.conventions)) {
    return { ok: false, ergebnis: fallback('konventionen_geaendert', 'Die Scan-Konventionen haben sich seit dem Voll-Scan geaendert') }
  }
  if (!voll.vorhaben || !voll.families || !hatW8Skalare(voll.tree)) {
    return { ok: false, ergebnis: fallback('report_vor_w8', 'Der gespeicherte Report stammt von vor W8 (Merge-Skalare fehlen) — einmal voll scannen') }
  }
  if (voll.familiesTruncated === true || teil.familiesTruncated === true) {
    return { ok: false, ergebnis: fallback('familien_gekappt', 'Familienliste gekappt — Aussen-Familien sind unvollstaendig') }
  }
  const kette = findeKette(voll.tree, args.scopeFolderId)
  if (!kette) {
    return { ok: false, ergebnis: fallback('scope_nicht_im_report', 'Der gescannte Ordner kommt im gespeicherten Report nicht vor') }
  }
  // Gap-Budget (Sammel-Gaps unter `ungesichtet`-Wurzeln) ist mergefaehig,
  // SOLANGE kein Vorfahr des Scopes ungesichtet ist: dann kreuzt kein
  // Kollaps-Teilbaum die Scope-Grenze, und die Sammel-Zaehler beider Seiten
  // bleiben exakt (aussen unveraendert, innen frisch vom Teil-Scan).
  if (kette.slice(0, -1).some((node) => node.bearbeitungsstand === 'ungesichtet')) {
    return { ok: false, ergebnis: fallback('ungesichteter_vorfahr', 'Ein Vorfahr des Scopes ist ungesichtet — sein Sammel-Gap kreuzt die Scope-Grenze') }
  }
  return { ok: true, scopeNode: kette[kette.length - 1] }
}
