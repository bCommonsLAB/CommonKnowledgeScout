/**
 * @fileoverview Entscheidung „Anhaenge als Text in die Suche" (P6).
 *
 * @description
 * Der unsichtbare Ingest-Anhang (`ingest-source-appendix.ts`) haengt die
 * Transkripte der verbundenen Quellen an den eingebetteten Text. Das
 * vervielfacht den Index (Prueffall Teil 2: 17 Chunks ohne, 239 mit Anhang).
 * Ob er gebaut wird, entscheidet in dieser Reihenfolge:
 *
 * 1. der Lauf (`parameters.appendixInSearch`, Dialog „Aufbereiten & Publizieren"),
 * 2. die Library (`config.ingestSourceAppendix`, Voreinstellung in den Einstellungen),
 * 3. der dokumentierte Standard: AN (Owner-Entscheidung 05.10.2026, „in die
 *    Suche soll die ganze Tiefe").
 *
 * Welche Ebene entschieden hat, steht im Ergebnis (`quelle`) und wird von
 * phase-ingest in den Trace geschrieben — kein stiller Default.
 *
 * @module external-jobs
 */

import type { Library } from '@/types/library'

/** Job-Parameter, den der Dialog pro Lauf setzt. */
export const APPENDIX_IN_SEARCH_PARAMETER = 'appendixInSearch'

export type AppendixDecisionSource = 'lauf' | 'library' | 'standard'

export interface AppendixDecision {
  anhang: boolean
  quelle: AppendixDecisionSource
}

export function resolveAppendixDecision(args: {
  parameters: Record<string, unknown> | undefined
  library: Pick<Library, 'config'> | undefined
}): AppendixDecision {
  const fromRun = args.parameters?.[APPENDIX_IN_SEARCH_PARAMETER]
  if (typeof fromRun === 'boolean') return { anhang: fromRun, quelle: 'lauf' }
  const fromLibrary = args.library?.config?.ingestSourceAppendix
  if (typeof fromLibrary === 'boolean') return { anhang: fromLibrary, quelle: 'library' }
  return { anhang: true, quelle: 'standard' }
}
