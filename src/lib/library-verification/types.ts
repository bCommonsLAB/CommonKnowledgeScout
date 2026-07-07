/**
 * Library-Verifikation (Welle A1) — Typen & Status-Vokabular.
 *
 * Eine Library traegt einen Verifikations-Status, der das Ergebnis des letzten
 * Prueflaufs widerspiegelt:
 * - `unchecked`   (ungeprueft)        — noch nie geprueft.
 * - `verified`    (geprueft)          — letzter Lauf ohne Befunde.
 * - `needs-repair`(reparaturbeduerftig)— letzter Lauf hatte Befunde (ggf. auto-fixbar).
 *
 * Der Status ist KEIN stiller Default: fehlt ein Pruefdokument, ist die Library
 * `unchecked` (siehe `no-silent-fallbacks.mdc`). Kein `enum` (Repo-Konvention) —
 * Union + const Map.
 */

export type LibraryVerificationStatus = 'unchecked' | 'verified' | 'needs-repair'

/** Kanonische Status-Werte als Map (vermeidet `enum`, siehe .cursorrules). */
export const LIBRARY_VERIFICATION_STATUS: Record<
  'unchecked' | 'verified' | 'needsRepair',
  LibraryVerificationStatus
> = {
  unchecked: 'unchecked',
  verified: 'verified',
  needsRepair: 'needs-repair',
}

/** Lauf-Modus: nur pruefen oder pruefen + auto-fixbare Faelle reparieren. */
export type VerificationMode = 'check' | 'repair'

/** Schweregrad eines Befunds. `error` blockiert „geprueft", `warning` nicht. */
export type VerificationSeverity = 'error' | 'warning'

/**
 * Stabile Befund-Codes (fuer Audit-Aggregation + UI-Mapping in A2).
 * Neue Codes hier ERGAENZEN, nicht in einem `default`-Zweig verschwinden lassen.
 */
export type VerificationIssueCode =
  | 'missing-base-field'
  | 'missing-required-field'
  | 'undetermined-detail-view-type'
  | 'invalid-detail-view-type'
  | 'facet-type-mismatch'
  | 'unnormalized-value'

/** Ein einzelner Befund an einem Dokument. */
export interface DocumentIssue {
  code: VerificationIssueCode
  severity: VerificationSeverity
  /** Betroffenes Metadaten-Feld (falls feldbezogen). */
  field?: string
  /** Lesbare Begruendung (deutsch). */
  message: string
  /** true, wenn der Befund deterministisch auto-reparierbar ist. */
  autoFixable: boolean
}

/** Zu pruefendes Dokument — bewusst storage-agnostisch (nur Metadaten). */
export interface VerifiableDocument {
  fileId: string
  fileName?: string
  /** Flaches Frontmatter/Metadaten-Objekt (docMetaJson). */
  docMetaJson: Record<string, unknown>
}

/** Pruefergebnis fuer ein Dokument. */
export interface DocumentVerificationResult {
  fileId: string
  fileName?: string
  /** Aufgeloester DetailViewType (per-Dokument > Library-Default), falls bestimmbar. */
  detailViewType?: string
  issues: DocumentIssue[]
  ok: boolean
}

/** Aggregierte Befund-Zaehlung je Code (fuer Audit + UI). */
export type IssueCountByCode = Partial<Record<VerificationIssueCode, number>>

/**
 * Aggregation je Code+Feld — das Detail-Log des Laufs. Im Gegensatz zur
 * gekappten `documents`-Liste UNGEKAPPT, damit die Zahlen auch bei grossen
 * Libraries stimmen. `sampleMessage` macht den Befund ohne Doc-Liste lesbar.
 */
export interface IssueFieldCount {
  code: VerificationIssueCode
  /** Betroffenes Feld; '' wenn feldlos (z.B. undetermined-detail-view-type). */
  field: string
  count: number
  /** Meldung des ersten Vorkommens (repraesentativ). */
  sampleMessage: string
}

/** Zusammenfassung eines Laufs. */
export interface VerificationSummary {
  scanned: number
  ok: number
  /** Dokumente mit mindestens einem Befund. */
  withIssues: number
  /** Summe aller Befunde. */
  totalIssues: number
  /** Anzahl auto-fixbarer Befunde (vor Reparatur). */
  autoFixable: number
  /** Tatsaechlich reparierte Dokumente (nur im `repair`-Modus > 0). */
  repairedDocuments: number
  issuesByCode: IssueCountByCode
  /** Detail-Aggregation je Code+Feld (fehlt bei Laeufen vor diesem Feature). */
  issuesByField?: IssueFieldCount[]
}

/** Vollstaendiger Bericht eines Verifikations-Laufs. */
export interface LibraryVerificationReport {
  libraryId: string
  status: LibraryVerificationStatus
  mode: VerificationMode
  summary: VerificationSummary
  /** Detailbefunde der Dokumente mit Problemen (saubere Dokumente weggelassen). */
  documents: DocumentVerificationResult[]
  /** ISO-Zeitpunkt der Berichtserstellung. */
  generatedAt: string
}

/**
 * Port (Hexagonal): Quelle der zu pruefenden Dokumente + Repair-Senke.
 * Die Engine kennt nur diesen Vertrag, NICHT das Storage-Backend
 * (storage-abstraction.mdc). Konkrete Adapter siehe `document-source.ts`.
 */
export interface LibraryDocumentSource {
  /** Liefert alle zu pruefenden Dokumente der Library. */
  listDocuments(): Promise<VerifiableDocument[]>
  /** Persistiert einen normalisierten Feld-Patch (flach, docMetaJson-Ebene). */
  applyRepair(fileId: string, patch: Record<string, unknown>): Promise<void>
}

/** Fortschritts-Ereignis (fuer SSE-Stream). */
export interface VerificationProgress {
  phase: 'start' | 'document' | 'done'
  current: number
  total: number
  /** Aktuell verarbeitetes Dokument (bei `phase === 'document'`). */
  fileId?: string
  /** Anzahl Befunde am aktuellen Dokument. */
  issueCount?: number
  /** Ob das aktuelle Dokument repariert wurde. */
  repaired?: boolean
}
