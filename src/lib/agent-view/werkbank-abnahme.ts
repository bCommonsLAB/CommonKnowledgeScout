/**
 * @fileoverview Abnahme-Fluss der Werkbank (Welle A4) — pur.
 *
 * @description
 * Die Sammelaktion ist nach ART getrennt (Entscheidung 3, 24.08.2026): je
 * ein Knopf fuer alle Transkripte und alle Zusammenfassungen, jeder mit
 * einer Rueckfrage, die die Zahl nennt. Hier wohnen die reinen Zutaten:
 * welche Artefakte offen sind (Ziele der Sammelaktion), das Einspielen
 * eines frisch verifizierten Artefakts in seine Familie und der Sprung zum
 * naechsten offenen Artefakt (Entscheidung 5).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { LeadingArtifactSummary, TwinFamilySummary } from './types'
import { artefaktGeprueft, familienPruefstand } from './werkbank-baum'

export type PruefbareArt = 'transkript' | 'zusammenfassung'

export interface SammelZiel {
  familie: TwinFamilySummary
  artefakt: LeadingArtifactSummary
}

/**
 * Offene Artefakte EINER Art im Teilbaum — die Ziele der Sammelaktion.
 * Familien ohne dieses Artefakt oder aus Scans vor A2 (`undefined`) fehlen
 * hier bewusst: Es gibt dort nichts Adressierbares zu verifizieren.
 */
export function sammelZiele(familien: readonly TwinFamilySummary[], art: PruefbareArt): SammelZiel[] {
  const ziele: SammelZiel[] = []
  for (const familie of familien) {
    const artefakt = familie[art]
    if (artefakt == null) continue
    if (artefaktGeprueft(artefakt)) continue
    ziele.push({ familie, artefakt })
  }
  return ziele
}

/** Familie mit frisch verifiziertem Artefakt (Kind der Kurations-Antwort). */
export function patchFamilie(
  familie: TwinFamilySummary,
  art: PruefbareArt,
  frisch: LeadingArtifactSummary,
): TwinFamilySummary {
  return { ...familie, [art]: frisch }
}

/**
 * Naechstes offenes Artefakt NACH `abSourceId` (Entscheidung 5) — vorwaerts
 * in Listen-Reihenfolge, am Ende von vorn; die Ausgangsfamilie selbst zaehlt
 * nicht. null = nichts mehr offen.
 */
export function naechstesOffenes(
  familien: readonly TwinFamilySummary[],
  abSourceId: string,
): TwinFamilySummary | null {
  const start = familien.findIndex((familie) => familie.sourceId === abSourceId)
  const anzahl = familien.length
  for (let schritt = 1; schritt <= anzahl; schritt += 1) {
    const familie = familien[(start + schritt + anzahl) % anzahl]
    if (familie === undefined || familie.sourceId === abSourceId) continue
    if (familienPruefstand(familie) === 'offen') return familie
  }
  return null
}

/** Der jeweils ANDERE pruefbare Tab derselben Familie, wenn er noch offen ist. */
export function andererOffenerTab(familie: TwinFamilySummary, art: PruefbareArt): PruefbareArt | null {
  const andere: PruefbareArt = art === 'transkript' ? 'zusammenfassung' : 'transkript'
  const artefakt = familie[andere]
  if (artefakt == null) return null
  return artefaktGeprueft(artefakt) ? null : andere
}
