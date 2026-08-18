/**
 * @fileoverview Deutsche Beschriftungen der Agentensicht (reine Funktionen).
 *
 * @description
 * Haelt Anzeigetexte AUSSERHALB der Komponenten: Der Baum (Welle 2), das
 * Zyklus-Board und spaeter der Auftrags-Generator (Welle 3) sprechen dieselbe
 * Sprache. Keine React-Abhaengigkeit, damit die Texte testbar bleiben.
 *
 * @module agent-view
 */

import { GAP_REGISTRY } from './gap-registry'
import { BEARBEITUNGSSTAND_VALUES, type Bearbeitungsstand, type CoverageGapType, type GapActor, type ZyklusSchritt } from './types'

const ACTOR_LABELS: Record<GapActor, string> = {
  mensch: 'Mensch',
  cowork: 'Cowork',
  knowledgescout: 'KnowledgeScout',
}

export function actorLabel(actor: GapActor): string {
  const label = ACTOR_LABELS[actor]
  if (!label) throw new Error(`Unbekannter Akteur: ${String(actor)}`)
  return label
}

/** Schritte des Erschliessungszyklus (`erschliessungszyklus.md` §1). */
const ZYKLUS_LABELS: Record<ZyklusSchritt, string> = {
  1: 'Schritt 1 — Sichten',
  2: 'Schritt 2 — Strukturieren',
  3: 'Schritt 3 — Berichten',
  4: 'Schritt 4 — Abnehmen',
}

export function zyklusSchrittLabel(schritt: ZyklusSchritt): string {
  const label = ZYKLUS_LABELS[schritt]
  if (!label) throw new Error(`Unbekannter Zyklus-Schritt: ${String(schritt)}`)
  return label
}

const STAND_LABELS: Record<Bearbeitungsstand, string> = {
  ungesichtet: 'Ungesichtet',
  erschlossen: 'Erschlossen',
  strukturiert: 'Strukturiert',
  berichtet: 'Berichtet',
  abgenommen: 'Abgenommen',
}

export function standLabel(stand: Bearbeitungsstand | null): string {
  if (stand === null) return 'Ohne erklaerten Stand'
  const label = STAND_LABELS[stand]
  if (!label) throw new Error(`Unbekannter Bearbeitungsstand: ${String(stand)}`)
  return label
}

/** Spalten des Zyklus-Boards: die fuenf Staende plus die undeklarierten Ordner. */
export const BOARD_COLUMNS: ReadonlyArray<Bearbeitungsstand | null> = [...BEARBEITUNGSSTAND_VALUES, null]

export function gapLabel(type: CoverageGapType): string {
  const def = GAP_REGISTRY[type]
  if (!def) throw new Error(`Unbekannter Gap-Typ: ${String(type)}`)
  return def.label
}

/** „3 Befunde" / „1 Befund" / „ohne Befund" — fuer Zaehler am Knoten. */
export function gapCountLabel(count: number): string {
  if (count <= 0) return 'ohne Befund'
  return count === 1 ? '1 Befund' : `${count} Befunde`
}

/** Kurzfassung der Akteur-Verteilung, z. B. „Mensch 1 · Cowork 2". */
export function actorSummary(counts: Record<GapActor, number>): string {
  const parts = (Object.keys(ACTOR_LABELS) as GapActor[])
    .filter((actor) => counts[actor] > 0)
    .map((actor) => `${actorLabel(actor)} ${counts[actor]}`)
  return parts.length === 0 ? 'keine offenen Todos' : parts.join(' · ')
}
