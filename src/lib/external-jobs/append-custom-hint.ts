/**
 * @fileoverview Helper: Korrekturhinweis (customHint) an Template-Content anhaengen
 *
 * @description
 * Haengt einen vom Anwender uebergebenen Korrekturhinweis ans Ende eines
 * Template-Contents an, BEVOR dieser an den LLM gesendet wird. Templates wie
 * `gaderform-bett-steckbrief-de.md` werten diesen Block aus, um z.B. einen
 * Modell-Anker zu setzen (Format: `Modell: <NAME>`).
 *
 * Single Source of Truth fuer das Anhaenge-Wording — wird sowohl vom
 * Markdown/Text-Pfad (`phase-template.ts`) als auch von beiden Image-Pfaden
 * (`start/route.ts` Image-Block, `run-composite-multi-image.ts`) genutzt.
 * Das verhindert Drift, wenn die Formulierung spaeter mal angepasst wird.
 *
 * Hintergrund (Bug 2026-04-28): Der Image-Pfad hat den Korrekturhinweis frueher
 * gar nicht ans LLM geschickt. Templates mit `Modell:`-Anker liefen deshalb
 * automatisch in den Fallback-Pfad ("Kein Modell-Anker im Korrekturhinweis
 * gefunden") — selbst bei korrektem User-Input. Siehe Chat-Diagnose 28.04.2026.
 *
 * @module external-jobs/append-custom-hint
 */

/**
 * Standardisierter Wortlaut, der dem Korrekturhinweis vorangestellt wird.
 *
 * Wichtig:
 * - Steht NACH dem auto-generierten Antwortschema = hoechste Prioritaet beim LLM.
 * - "VERBINDLICHER KORREKTURHINWEIS" ist der exakte Marker, auf den z.B. das
 *   `gaderform-bett-steckbrief-de`-Template im Systemprompt verweist
 *   (Z. 70-79). Wenn dieser Marker geaendert wird, muessen die Templates
 *   parallel angepasst werden.
 */
const CUSTOM_HINT_PREAMBLE =
  'VERBINDLICHER KORREKTURHINWEIS (höchste Priorität – überschreibt Extraktion aus Pfad/Dokument):\n' +
  'Der Anwender hat folgende Korrektur angegeben. Setze die genannten Felder EXAKT wie angegeben – ' +
  'ignoriere dabei die üblichen Extraktionsregeln aus Pfad und Dokument.\n\n'

export interface AppendCustomHintResult {
  /** Template-Content nach dem Anhaengen (oder unveraendert, wenn kein Hint). */
  content: string
  /** True, wenn ein nicht-leerer Hint angehaengt wurde. */
  appended: boolean
  /** Laenge des angehaengten Hint nach Trimming (0, wenn appended=false). */
  hintLength: number
}

/**
 * Haengt den Korrekturhinweis ans Ende des Template-Contents an.
 *
 * Verhalten:
 * - Trimmt `customHint` (whitespace-only zaehlt als leer).
 * - Bei `null`/`undefined`/leer: Template-Content wird unveraendert
 *   zurueckgegeben (`appended: false`). KEIN stiller Fallback, KEIN throw —
 *   die Abwesenheit eines Hints ist ein legitimer Zustand.
 * - Sonst: Template-Content + Leerzeile + Praeambel + Hint.
 *
 * @param templateContent Original-Template (Body + Systemprompt + Schema).
 * @param customHint Vom Anwender im UI eingegebener Korrekturhinweis.
 * @returns AppendCustomHintResult mit `content` und Diagnose-Flags.
 */
export function appendCustomHintToTemplate(
  templateContent: string,
  customHint: string | undefined | null
): AppendCustomHintResult {
  if (typeof customHint !== 'string') {
    return { content: templateContent, appended: false, hintLength: 0 }
  }
  const trimmed = customHint.trim()
  if (!trimmed) {
    return { content: templateContent, appended: false, hintLength: 0 }
  }
  return {
    content: `${templateContent}\n\n${CUSTOM_HINT_PREAMBLE}${trimmed}`,
    appended: true,
    hintLength: trimmed.length,
  }
}
