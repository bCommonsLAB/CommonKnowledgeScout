/**
 * @fileoverview K1-Overlay: nachgeladener Kurationszustand → Overrides (pur).
 *
 * @description
 * K1 der Testsession 25.08.2026: Nach einem Reload zeigte die Werkbank den
 * GESPEICHERTEN Report (Scan von vor den Verifikationen) — die Arbeit war in
 * den Mongo-Twins laengst geschrieben, aber erst ein Voll-Scan (~8 Minuten)
 * machte sie wieder sichtbar. Die Route `agent-view/kuration` laedt den
 * Kurationszustand je Vorhaben in EINER Mongo-Abfrage nach; diese Datei
 * uebersetzt ihre Eintraege in die Override-Map, die `useWerkbankBaum` schon
 * fuer frische In-Session-Verifikationen kennt (`effektiveFamilie`).
 * Session-Overrides gewinnen gegen Nachgeladenes — die eigene, juengste
 * Aktion schlaegt den Snapshot.
 *
 * Reine Funktionen, kein I/O — client-sicher.
 *
 * @module agent-view
 */

import type { LeadingArtifactSummary } from './types'
import { artefaktKey } from './werkbank-baum'

/** Kurationszustand EINER Familie aus MongoDB (Antwortzeile der Route). */
export interface KurationsEintrag {
  sourceId: string
  transkript: LeadingArtifactSummary | null
  zusammenfassung: LeadingArtifactSummary | null
}

/**
 * Baut die Basis-Override-Map aus den nachgeladenen Eintraegen: je
 * vorhandenem pruefbaren Artefakt ein Override unter seinem
 * {@link artefaktKey}. Familien ohne Eintrag bleiben unberuehrt — dort
 * gilt weiter der Report (kein Raten).
 */
export function baueNachladeOverrides(
  eintraege: readonly KurationsEintrag[],
): Map<string, LeadingArtifactSummary> {
  const overrides = new Map<string, LeadingArtifactSummary>()
  for (const eintrag of eintraege) {
    for (const artefakt of [eintrag.transkript, eintrag.zusammenfassung]) {
      if (artefakt === null) continue
      overrides.set(artefaktKey(eintrag.sourceId, artefakt), artefakt)
    }
  }
  return overrides
}

/**
 * Nachgeladene Basis + Session-Overrides zu EINER Map — Session gewinnt
 * (die eigene Verifikation dieser Sitzung ist juenger als der Snapshot).
 */
export function mergeOverrides(
  basis: ReadonlyMap<string, LeadingArtifactSummary>,
  session: ReadonlyMap<string, LeadingArtifactSummary>,
): ReadonlyMap<string, LeadingArtifactSummary> {
  if (basis.size === 0) return session
  return new Map([...basis, ...session])
}
