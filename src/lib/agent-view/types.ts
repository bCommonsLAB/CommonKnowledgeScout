/**
 * @fileoverview Typen der Agentensicht (Welle 1) — Lueckenmodell + Coverage-Report.
 *
 * @description
 * Die Agentensicht ist eine KOMPOSITIONSSCHICHT: Sie orchestriert die
 * vorhandenen Pruefmaschinen (Sync-Engine-Check, Twin-Kern-Regeln) und
 * ergaenzt nur, was keine kann (Archiv-Konventionen, Verweis-Audit,
 * Aggregation). Sie ist KEIN drittes Pruefsystem
 * (`docs/concepts/projektauftrag-agentensicht.md` §2 Leitprinzip 1).
 *
 * Einziges Persistenzartefakt ist der `CoverageReport` — abgeleitet und
 * WEGWERFBAR: Report loeschen ⇒ der naechste Scan stellt ihn vollstaendig
 * wieder her (Akzeptanzkriterium 6).
 *
 * @module agent-view
 */

/** Zustaendiger Akteur eines Befunds (F2 Todo-Routing). */
export type GapActor = 'mensch' | 'cowork' | 'knowledgescout'

/** Schritt des Erschliessungszyklus (`docs/concepts/erschliessungszyklus.md` §1). */
export type ZyklusSchritt = 1 | 2 | 3 | 4

/** Schweregrad. `info` zaehlt nicht gegen „gruen", `warning`/`error` schon. */
export type GapSeverity = 'error' | 'warning' | 'info'

/**
 * Gap-Typen (F2 Startset). Neue Typen hier ERGAENZEN und in der
 * `GAP_REGISTRY` beschreiben — kein `default`-Zweig, in dem sie verschwinden
 * (`no-silent-fallbacks.mdc`).
 */
export type CoverageGapType =
  // — Sync-Engine-Check (vorhanden, wird nur uebersetzt) —
  | 'source_without_twin'
  | 'orphan_twin'
  | 'conflict'
  | 'twin_stale'
  | 'legacy_twin_name'
  | 'path_too_long'
  // — Twin-Kern-/Verifikations-Regeln (Contract §3) —
  | 'twin_core_missing'
  | 'twin_unverified'
  | 'self_verified'
  | 'transformation_missing'
  | 'transformation_stale'
  // — Archiv-Konventionen —
  | 'report_missing'
  | 'index_missing'
  | 'bericht_veraltet'
  | 'stand_widerspruch'
  // — Verweis-Audit (doppelte Buchhaltung) —
  | 'verweis_tot'
  | 'verweis_veraltet'
  | 'bericht_unvollstaendig'
  // — Budget + Betrieb —
  | 'teilbaum_ungesichtet'
  | 'scan_error'

/** Ebene, auf die sich ein Befund bezieht. */
export type GapScope = 'library' | 'folder' | 'source'

/** Ein einzelner Befund — ein pruefbarer Regelverstoss gegen den Contract. */
export interface CoverageGap {
  type: CoverageGapType
  actor: GapActor
  zyklusSchritt: ZyklusSchritt
  severity: GapSeverity
  scope: GapScope
  /** Storage-Id des betroffenen Knotens (Ordner- bzw. Quell-Id). */
  targetId: string
  /** Anzeigename des betroffenen Knotens. */
  targetName: string
  /** Ordner-Id, unter der der Befund im Baum aggregiert wird. */
  folderId: string
  /** Library-relativer Pfad des betroffenen Knotens (Anzeige + Auftragstext). */
  path: string
  /** Deutsche Klartext-Begruendung. */
  message: string
  /** Optionales Detail (fehlende Felder, Verweis-Ziel, Zaehler). */
  detail?: string
}

/** Erklaerter Ordner-Stand aus dem `_INDEX.md` (Zyklus §4). */
export const BEARBEITUNGSSTAND_VALUES = [
  'ungesichtet',
  'erschlossen',
  'strukturiert',
  'berichtet',
  'abgenommen',
] as const

export type Bearbeitungsstand = (typeof BEARBEITUNGSSTAND_VALUES)[number]

/** Zaehler je Gap-Typ bzw. Akteur. */
export type GapCountByType = Partial<Record<CoverageGapType, number>>
export type GapCountByActor = Record<GapActor, number>

/** Knoten des Agenten-Baums (F1) — Ordner mit aggregierten Zaehlern. */
export interface CoverageTreeNode {
  folderId: string
  name: string
  path: string
  depth: number
  /** Erklaerter Stand aus `_INDEX.md` (null = kein Index bzw. kein Feld). */
  bearbeitungsstand: Bearbeitungsstand | null
  bearbeitungsstandSeit: string | null
  hasIndex: boolean
  hasBericht: boolean
  /** Quellen (Dateien mit Twin-Familie) direkt in diesem Ordner. */
  sourceCount: number
  /** Dateien direkt in diesem Ordner (ohne Twin-Ordner-Inhalte). */
  fileCount: number
  /** Befunde direkt an diesem Ordner bzw. seinen Quellen. */
  ownGaps: number
  /** Befunde inkl. aller Teilbaeume. */
  totalGaps: number
  gapsByType: GapCountByType
  gapsByActor: GapCountByActor
  /** Ampel: gruen nur ohne Befund im Teilbaum (Akzeptanzkriterium 7). */
  ampel: 'gruen' | 'gelb' | 'rot'
  children: CoverageTreeNode[]
}

/** Karte des Zyklus-Boards (F1b) — ein Vorhaben mit Soll/Ist. */
export interface VorhabenCard {
  folderId: string
  name: string
  path: string
  bearbeitungsstand: Bearbeitungsstand | null
  bearbeitungsstandSeit: string | null
  hasBericht: boolean
  totalGaps: number
  gapsByActor: GapCountByActor
  gapsByType: GapCountByType
  /** Erklaerter Stand ist durch Befunde widerlegt (`stand_widerspruch`). */
  widerspruch: boolean
}

/** Konventionen, unter denen der Scan lief (sichtbar statt hartkodiert). */
export interface CoverageConventions {
  /** Standard-Template der Library (fuehrendes Artefakt, Contract §2b). */
  standardTemplate: string | null
  /** Regex fuer Vorhabensordner; null = nur Selbstdeklaration per `_INDEX.md`. */
  vorhabenFolderPattern: string | null
  /** Bis zu dieser Tiefe ist `_INDEX.md` Pflicht; null = Regel inaktiv. */
  indexRequiredMaxDepth: number | null
  /** `bericht_veraltet` aktiv? */
  berichtFreshness: boolean
  /** Wirksame Ausschluss-Muster des Scans (Welle 0b). */
  scanExcludeGlobs: string[]
}

export interface CoverageTotals {
  folders: number
  files: number
  sources: number
  twins: number
  gaps: number
  gapsByType: GapCountByType
  gapsByActor: GapCountByActor
  /**
   * Durch Ausschluss-Muster uebersprungen (Welle 0b) — getrennt nach Quelle,
   * weil Archiv-Scan und Sync-Engine dieselben Teilbaeume je EINMAL zaehlen.
   * Sichtbar statt still (Gap-Budget, `no-silent-fallbacks.mdc`).
   */
  skippedExcluded: { archive: number; engine: number }
  /** Durch Sammel-Gaps (`ungesichtet`) zusammengefasste Einzel-Befunde. */
  collapsedGaps: number
  scanErrors: number
}

/**
 * Der Coverage-Report — ABGELEITET und WEGWERFBAR (Leitprinzip 2).
 * Genau EIN Dokument je Library in Mongo; Loeschen ist folgenlos.
 */
export interface CoverageReport {
  libraryId: string
  generatedAt: string
  /** Bewusst redundante Kennzeichnung: dieser Report ist kein Wahrheitstraeger. */
  derived: true
  scope: { folderId: string | null }
  conventions: CoverageConventions
  totals: CoverageTotals
  gaps: CoverageGap[]
  tree: CoverageTreeNode[]
  vorhaben: VorhabenCard[]
}
