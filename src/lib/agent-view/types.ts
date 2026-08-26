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

/**
 * Schweregrad. Fuer die AMPEL zaehlt seit dem Beschluss vom 24.08.2026 der
 * Akteur, nicht die Severity (siehe {@link CoverageAmpel}); der strengere
 * F8-Abnahme-Precheck (W7) filtert weiterhin auf `error`/`warning`.
 */
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
  // — Library-Verifikation A1 (vorhanden, wird nur uebersetzt) —
  | 'core_fields_missing'
  // — Twin-Kern-/Verifikations-Regeln (Contract §3) —
  | 'twin_core_missing'
  | 'twin_flagged'
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
  // — Archiv-Hygiene (W5-Nachzug) —
  | 'datei_ohne_endung'

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
  /**
   * Nur Sammel-Gaps (`teilbaum_ungesichtet`): Anzahl zusammengefasster
   * Einzel-Befunde — strukturiert (W8), damit der Merge `collapsedGaps`
   * exakt rekonstruiert, statt den eigenen Message-Text zu parsen.
   */
  anzahl?: number
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

/**
 * Ampelfarbe — AKTEUR-basiert (Beschluss 24.08.2026): `rot` = maschinelle
 * Befunde (cowork/knowledgescout) offen, `gelb` = nur noch Mensch-Befunde
 * (das geteilte Praedikat „bereit zur Abnahme"), `gruen` nur ohne Befund im
 * Teilbaum (Akzeptanzkriterium 7 bleibt unangetastet).
 */
export type CoverageAmpel = 'gruen' | 'gelb' | 'rot'

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
  ampel: CoverageAmpel
  /**
   * Juengste EIGENE Aenderung des Ordners (Dateien ohne Contract-Dateien +
   * Twin-Artefakte; W8-Merge-Grundlage: Teilbaum-Maxima sind daraus bottom-up
   * ableitbar). Fehlt in Reports vor W8 — der Merge weist das benannt zurueck.
   */
  neuesteEigeneAenderung?: string | null
  /** Bericht-Skalare fuer die Merge-Neubewertung von `bericht_veraltet` (W8). */
  berichtFileId?: string | null
  berichtModifiedAt?: string | null
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
  /*
   * Werkbank-Felder (F9, Welle W1) — Kleinst-Skalare aus den beim Scan
   * ohnehin gelesenen Bericht-Daten. OPTIONAL, weil gespeicherte Reports aus
   * Scans vor W1 sie nicht tragen: Konsumenten benennen diesen Zustand
   * sichtbar (Muster „Scan vor Welle 4"), statt still zu raten.
   */
  /** Ampel des Baumknotens (uebernommen, nicht neu gerechnet). */
  ampel?: CoverageAmpel
  /** H1 des BERICHT.md via `titelLesen`; '' = Bericht ohne H1, null = kein Bericht. */
  berichtTitel?: string | null
  /** Storage-Id des BERICHT.md (Deep-Link `?openFileId=`); null = kein Bericht. */
  berichtFileId?: string | null
  /** `modifiedAt` des BERICHT.md als ISO; null = kein Bericht/unbekannt. */
  berichtModifiedAt?: string | null
  /** Frontmatter `status` des BERICHT.md; null = kein Bericht/kein Feld. */
  berichtStatus?: string | null
  /**
   * `themen` aus dem BERICHT.md-Frontmatter (F12). Seit A6 NICHT mehr die
   * Grundlage der Gruppierung „Thema" — das Feld enthaelt technische
   * Bausteine und bleibt nur fuer die W1-Erkennung und die Sichten.
   */
  themen?: string[]
  /**
   * A6 (Entscheidung Peter, 25.08.2026): die VON HAND gepflegten Themen aus
   * dem `_INDEX.md`-Frontmatter (`themen:`, flache YAML-Liste,
   * Obsidian-kompatibel; ein Einzelwert zaehlt als Liste mit einem Element).
   * [] = kein Thema vergeben („Ohne Thema"); fehlt in Reports vor A6.
   */
  gepflegteThemen?: string[]
}

/**
 * Vertrauensampel des fuehrenden Artefakts (F1/F4): Verifikation zaehlt nur
 * bei `verified_at >= generated_at` (Contract §3.2) — sonst `ungueltig`.
 */
export type VerificationState = 'unverifiziert' | 'maschinell' | 'mensch' | 'ungueltig'

/** Fuehrendes Artefakt einer Twin-Familie mit Kurationszustand (F4). */
export interface LeadingArtifactSummary {
  kind: 'transcript' | 'transformation'
  templateName: string | null
  targetLanguage: string
  /** Roher `twin_status`-Wert (ungueltige Werte bleiben sichtbar, kein stilles null). */
  twinStatus: string | null
  generatedBy: string | null
  generatedAt: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  verification: VerificationState
}

/** Eine Twin-Familie im Report — der Twin-Knoten des Baums (F1, F4). */
export interface TwinFamilySummary {
  sourceId: string
  sourceName: string
  folderId: string
  path: string
  /** Artefakte der Familie (Transkript + Transformationen). */
  artifactCount: number
  /** null = Familie ohne fuehrendes Artefakt (weder Transkript noch Standard-Transformation). */
  leading: LeadingArtifactSummary | null
  /*
   * Pruefbare Artefakte (Welle A2): Der Baum und die Tabs des Details tragen
   * je Artefakt ein eigenes Haekchen (Entscheidung 4, 24.08.2026) — dafuer
   * braucht der Report BEIDE Kurationszustaende, nicht nur den fuehrenden.
   * OPTIONAL, weil Reports aus Scans vor A2 die Felder nicht tragen:
   * Konsumenten benennen diesen Zustand („neu scannen"), statt zu raten.
   */
  /** Transkript-Artefakt; null = Familie ohne Transkript. Fehlt in Reports vor A2. */
  transkript?: LeadingArtifactSummary | null
  /** Standard-Transformation („Zusammenfassung"); null = keine (auch: kein Standard-Template). */
  zusammenfassung?: LeadingArtifactSummary | null
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
  /**
   * Teilbaum-Scope des Scans. `path` ist der library-relative Pfad der
   * Scan-Wurzel, WENN der Aufrufer ihn kennt (z. B. MCP-Scan per `pfad`) —
   * Baum- und Befund-Pfade im Report sind SCOPE-relativ; mit `path` koennen
   * Konsumenten library-relative Filter darauf abbilden.
   */
  scope: { folderId: string | null; path?: string | null }
  conventions: CoverageConventions
  totals: CoverageTotals
  gaps: CoverageGap[]
  tree: CoverageTreeNode[]
  vorhaben: VorhabenCard[]
  /**
   * Twin-Familien mit Kurationszustand (Welle 4, F4). OPTIONAL, weil Reports
   * aus Scans vor Welle 4 das Feld nicht tragen — die UI benennt diesen
   * Zustand („neu scannen") statt still nichts zu zeigen.
   */
  families?: TwinFamilySummary[]
  /** true, wenn `families` am Budget gekappt wurde (sichtbar statt still). */
  familiesTruncated?: boolean
}
