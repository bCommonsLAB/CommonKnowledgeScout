/**
 * @fileoverview K1-Nachladen: Kurationszustand je Vorhaben aus MongoDB (Server).
 *
 * @description
 * Die Verifikation steckt in den Mongo-Twins, nicht im Storage-Scan
 * (Testsession 25.08.2026, K1). Diese Datei bildet die Twin-Dokumente EINER
 * Mongo-Abfrage auf die Kurations-Eintraege der Route ab — mit EXAKT der
 * Auswahllogik des Coverage-Scans (`toRawTwinFamily` + `buildFamilySummaries`,
 * kein zweites Regelwerk): dieselbe Standard-Template-Aufloesung, dieselbe
 * Vertrauensampel. Kein Storage-Zugriff, kein Graph-Aufruf, kein Voll-Scan.
 *
 * @module agent-view
 */

import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { buildFamilySummaries } from './family-summaries'
import type { KurationsEintrag } from './kuration-overlay'
import { toRawTwinFamily } from './run-coverage-scan'

/**
 * Twin-Dokumente → Kurations-Eintraege. Der Fundort spielt fuer den Overlay
 * keine Rolle (der Report kennt ihn bereits) — die Familien-Sicht wird nur
 * mit parentId/sourceName als Platzhalter-Ort gebaut.
 */
export function baueKurationsEintraege(
  docs: readonly ShadowTwinDocument[],
  standardTemplate: string | null,
): KurationsEintrag[] {
  const families = docs.map((doc) => {
    const raw = toRawTwinFamily(doc)
    return { ...raw, folderId: raw.parentId, path: raw.sourceName }
  })
  return buildFamilySummaries({ families, standardTemplate }).families.map((familie) => ({
    sourceId: familie.sourceId,
    transkript: familie.transkript ?? null,
    zusammenfassung: familie.zusammenfassung ?? null,
  }))
}
