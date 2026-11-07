/**
 * @fileoverview Fehlertext der Template-Phase, wenn der Transformer kein
 * `structured_data` liefert.
 *
 * @description
 * Befund 06.11.2026 (SFSCON-Aufbau): `runTemplateTransform` gibt im Fehlerfall
 * `{ metadata: null, error }` zurueck — und `error` ist der Satz, der den
 * Fehlschlag erklaert (Vorpruefung des Composite-Fensters, HTTP-Status,
 * Meldung des Secretary). `phase-template.ts` las nur `tr.meta`, warf
 * „Transformer lieferte kein gültiges structured_data" und liess `error`
 * fallen; `job_status` zeigte den Satz ohne Ursache. Hier wird die Ursache
 * angehaengt. Der Satz davor bleibt unveraendert, weil Fehlerdeutung und
 * Tests ihn kennen.
 *
 * @module external-jobs
 */

import type { TemplateRunResult } from '@/types/external-jobs'

export const OHNE_STRUCTURED_DATA = 'Transformer lieferte kein gültiges structured_data'

/** „Transformer lieferte kein gültiges structured_data (HTTP 400 BAD REQUEST): <Ursache>". */
export function fehlertextOhneStructuredData(
  tr: Pick<TemplateRunResult, 'error' | 'status' | 'statusText'>,
): string {
  const ursache = typeof tr.error === 'string' ? tr.error.trim() : ''
  const statusText = typeof tr.statusText === 'string' && tr.statusText.trim() ? ` ${tr.statusText.trim()}` : ''
  const status = typeof tr.status === 'number' ? ` (HTTP ${tr.status}${statusText})` : ''
  return ursache ? `${OHNE_STRUCTURED_DATA}${status}: ${ursache}` : `${OHNE_STRUCTURED_DATA}${status}`
}
