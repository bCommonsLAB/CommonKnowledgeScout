/**
 * @fileoverview Gap-Registry: Herkunft, Akteur und Zyklus-Schritt je Gap-Typ.
 *
 * @description
 * Die Tabelle aus dem Projektauftrag F2 als Code — EINE Quelle fuer das
 * Todo-Routing (Mensch / Cowork / KnowledgeScout) und fuer die Anzeige.
 * Registry als `Record` statt `enum` (.cursorrules) und VOLLSTAENDIG:
 * ein neuer Gap-Typ ohne Eintrag ist ein Typfehler, kein stiller Default.
 *
 * @module agent-view
 */

import type {
  CoverageGap,
  CoverageGapType,
  GapActor,
  GapScope,
  GapSeverity,
  ZyklusSchritt,
} from './types'

/** Woher der Befund kommt — Nachweis der Komposition (kein Doppel-Pruefsystem). */
export type GapOrigin =
  | 'sync-engine'
  | 'library-verification'
  | 'twin-contract'
  | 'archiv-konvention'
  | 'verweis-audit'
  | 'budget'

export interface GapDefinition {
  actor: GapActor
  zyklusSchritt: ZyklusSchritt
  severity: GapSeverity
  origin: GapOrigin
  /** Kurzbeschreibung (deutsch) fuer UI und Auftragstexte. */
  label: string
}

export const GAP_REGISTRY: Record<CoverageGapType, GapDefinition> = {
  // — Sync-Engine-Check (vorhanden) —
  source_without_twin: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'error', origin: 'sync-engine', label: 'Quelle ohne Twin' },
  orphan_twin: { actor: 'knowledgescout', zyklusSchritt: 2, severity: 'warning', origin: 'sync-engine', label: 'Twin ohne Quelle' },
  conflict: { actor: 'knowledgescout', zyklusSchritt: 4, severity: 'error', origin: 'sync-engine', label: 'Spiegel und Datenbank divergieren' },
  twin_stale: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'warning', origin: 'sync-engine', label: 'Quelle juenger als ihr Twin' },
  legacy_twin_name: { actor: 'knowledgescout', zyklusSchritt: 2, severity: 'warning', origin: 'sync-engine', label: 'Alt-Name eines Twins' },
  path_too_long: { actor: 'cowork', zyklusSchritt: 2, severity: 'warning', origin: 'sync-engine', label: 'Pfad ueber dem Budget' },

  // — Library-Verifikation A1 (vorhanden) —
  core_fields_missing: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'error', origin: 'library-verification', label: 'A0-Pflichtfelder fehlen' },

  // — Twin-Kern / Verifikation (Contract §3) —
  twin_core_missing: { actor: 'knowledgescout', zyklusSchritt: 2, severity: 'warning', origin: 'twin-contract', label: 'Twin-Kern unvollstaendig' },
  twin_unverified: { actor: 'mensch', zyklusSchritt: 4, severity: 'warning', origin: 'twin-contract', label: 'Fuehrendes Artefakt unverifiziert' },
  self_verified: { actor: 'mensch', zyklusSchritt: 4, severity: 'error', origin: 'twin-contract', label: 'Selbst-Verifikation' },
  transformation_missing: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'error', origin: 'twin-contract', label: 'Transformation fehlt' },
  transformation_stale: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'info', origin: 'twin-contract', label: 'Transformation aelter als Transkript' },

  // — Archiv-Konventionen —
  report_missing: { actor: 'cowork', zyklusSchritt: 3, severity: 'warning', origin: 'archiv-konvention', label: 'BERICHT.md fehlt' },
  index_missing: { actor: 'cowork', zyklusSchritt: 2, severity: 'warning', origin: 'archiv-konvention', label: '_INDEX.md fehlt' },
  bericht_veraltet: { actor: 'cowork', zyklusSchritt: 3, severity: 'warning', origin: 'archiv-konvention', label: 'BERICHT.md veraltet' },
  stand_widerspruch: { actor: 'mensch', zyklusSchritt: 4, severity: 'error', origin: 'archiv-konvention', label: 'Erklaerter Stand widerlegt' },

  // — Verweis-Audit —
  verweis_tot: { actor: 'cowork', zyklusSchritt: 3, severity: 'error', origin: 'verweis-audit', label: 'Toter Verweis' },
  verweis_veraltet: { actor: 'cowork', zyklusSchritt: 3, severity: 'warning', origin: 'verweis-audit', label: 'Veralteter Verweis' },
  bericht_unvollstaendig: { actor: 'cowork', zyklusSchritt: 3, severity: 'info', origin: 'verweis-audit', label: 'Bericht laesst Quellen unerwaehnt' },

  // — Budget + Betrieb —
  teilbaum_ungesichtet: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'info', origin: 'budget', label: 'Ungesichteter Teilbaum' },
  scan_error: { actor: 'knowledgescout', zyklusSchritt: 1, severity: 'error', origin: 'budget', label: 'Scan-Fehler' },

  // — Archiv-Hygiene (W5-Nachzug, Cowork-Befund: abgeschnittene Sync-Reste) —
  datei_ohne_endung: { actor: 'mensch', zyklusSchritt: 1, severity: 'warning', origin: 'archiv-konvention', label: 'Datei ohne Endung (Sync-Rest?)' },
}

/**
 * `stand_widerspruch` routet auf den Schritt, hinter den das Vorhaben
 * zurueckgefallen ist (F2). Der Aufrufer liefert den ausloesenden Gap-Typ;
 * ohne ausloesenden Typ bleibt der Registry-Default (Schritt 4).
 */
export function routeStandWiderspruch(triggerTypes: readonly CoverageGapType[]): {
  actor: GapActor
  zyklusSchritt: ZyklusSchritt
} {
  let earliest: GapDefinition | null = null
  for (const type of triggerTypes) {
    const def = GAP_REGISTRY[type]
    if (!earliest || def.zyklusSchritt < earliest.zyklusSchritt) earliest = def
  }
  if (!earliest) return { actor: GAP_REGISTRY.stand_widerspruch.actor, zyklusSchritt: GAP_REGISTRY.stand_widerspruch.zyklusSchritt }
  return { actor: earliest.actor, zyklusSchritt: earliest.zyklusSchritt }
}

export interface CreateGapArgs {
  type: CoverageGapType
  scope: GapScope
  targetId: string
  targetName: string
  folderId: string
  path: string
  message: string
  detail?: string
  /** Nur `stand_widerspruch`: Routing auf den zurueckgefallenen Schritt. */
  actorOverride?: GapActor
  zyklusSchrittOverride?: ZyklusSchritt
}

/** Baut einen Befund und zieht Akteur/Schritt/Schwere aus der Registry. */
export function createGap(args: CreateGapArgs): CoverageGap {
  const def = GAP_REGISTRY[args.type]
  if (!def) throw new Error(`Unbekannter Gap-Typ: ${String(args.type)}`)
  return {
    type: args.type,
    actor: args.actorOverride ?? def.actor,
    zyklusSchritt: args.zyklusSchrittOverride ?? def.zyklusSchritt,
    severity: def.severity,
    scope: args.scope,
    targetId: args.targetId,
    targetName: args.targetName,
    folderId: args.folderId,
    path: args.path,
    message: args.message,
    ...(args.detail ? { detail: args.detail } : {}),
  }
}

/** Deterministische Reihenfolge: Pfad → Typ → Ziel (Report-Wegwerf-Test). */
export function sortGaps(gaps: readonly CoverageGap[]): CoverageGap[] {
  return [...gaps].sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.type.localeCompare(b.type) ||
      a.targetName.localeCompare(b.targetName) ||
      a.targetId.localeCompare(b.targetId),
  )
}
