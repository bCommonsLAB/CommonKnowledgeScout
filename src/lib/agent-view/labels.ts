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

import { TWIN_STATUS_VALUES } from '@/lib/shadow-twin/twin-core-fields'
import { GAP_REGISTRY } from './gap-registry'
import {
  BEARBEITUNGSSTAND_VALUES,
  type Bearbeitungsstand,
  type CoverageGapType,
  type GapActor,
  type VerificationState,
  type ZyklusSchritt,
} from './types'

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

const VERIFICATION_LABELS: Record<VerificationState, string> = {
  unverifiziert: 'Unverifiziert',
  maschinell: 'Maschinell bestaetigt',
  mensch: 'Von Mensch geprueft',
  ungueltig: 'Verifikation ungueltig (aelter als die Generierung)',
}

/** Vertrauensampel-Text des fuehrenden Artefakts (F1/F4). */
export function verificationLabel(state: VerificationState): string {
  const label = VERIFICATION_LABELS[state]
  if (!label) throw new Error(`Unbekannter Verifikationszustand: ${String(state)}`)
  return label
}

const TWIN_STATUS_LABELS: Record<(typeof TWIN_STATUS_VALUES)[number], string> = {
  draft: 'Entwurf',
  stable: 'Stabil',
  deprecated: 'Veraltet',
}

/**
 * Anzeigename eines `twin_status`-Werts. Unbekannte Werte aus dem Bestand
 * bleiben roh sichtbar (kein stilles Umdeuten); null = Feld fehlt.
 */
export function twinStatusLabel(status: string | null): string {
  if (status === null) return 'Ohne Status'
  return TWIN_STATUS_LABELS[status as keyof typeof TWIN_STATUS_LABELS] ?? `Unbekannt: ${status}`
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
