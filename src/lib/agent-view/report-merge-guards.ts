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

import type { CoverageConventions, CoverageReport, CoverageTreeNode } from './types'

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

/**
 * Vergleich je Konventionsfeld — VOLLSTAENDIGES `Record` (Muster
 * `GAP_REGISTRY`): Ein neues Feld ohne Eintrag ist ein TYPFEHLER, kein
 * stilles Loch.
 *
 * Befund 09.09.2026 (Cowork): Die frühere Fassung zaehlte fuenf von acht
 * Feldern auf; `postfachMaxRueckstandWochen` (A7b), `repoMaxRueckstandTage`
 * (C1) und `themenVokabularGepflegt` (B3c) fehlten. Folge war kein blosser
 * Anzeigefehler: Weil `mergeReports` die Konventionen des
 * GESPEICHERTEN Voll-Reports uebernimmt, hat ein Teilbaum-Scan nach einer
 * Schwellen-Aenderung stillschweigend weiter mit der alten Schwelle
 * geantwortet — und ein Agent konnte nicht erkennen, ob eine Regel scharf
 * ist. Genau dafuer ist `conventions` da (`no-silent-fallbacks.md`).
 *
 * Ein gespeicherter Report von VOR einem neuen Feld traegt dort `undefined`
 * und ist damit ungleich `null` — der Merge faellt dann laut zurueck
 * („einmal voll scannen"), statt eine unbekannte Konvention zu behaupten.
 */
const KONVENTIONEN_VERGLEICH: {
  [K in keyof CoverageConventions]: (a: CoverageConventions[K], b: CoverageConventions[K]) => boolean
} = {
  standardTemplate: (a, b) => a === b,
  vorhabenFolderPattern: (a, b) => a === b,
  indexRequiredMaxDepth: (a, b) => a === b,
  berichtFreshness: (a, b) => a === b,
  postfachMaxRueckstandWochen: (a, b) => a === b,
  repoMaxRueckstandTage: (a, b) => a === b,
  themenVokabularGepflegt: (a, b) => a === b,
  scanExcludeGlobs: (a, b) => a.length === b.length && a.every((glob, idx) => glob === b[idx]),
}

function konventionenGleich(a: CoverageConventions, b: CoverageConventions): boolean {
  for (const key of Object.keys(KONVENTIONEN_VERGLEICH) as (keyof CoverageConventions)[]) {
    // Der Cast buendelt die feldweise korrekten Signaturen des Records auf
    // einen gemeinsamen Aufruf — die Typsicherheit steckt in der Tabelle.
    const gleich = KONVENTIONEN_VERGLEICH[key] as (x: unknown, y: unknown) => boolean
    if (!gleich(a[key], b[key])) return false
  }
  return true
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
