/**
 * Kurztitel einer Antwort (D5, Plan `story-dreiteilung-fragenchronik`).
 *
 * Das Sprachmodell liefert `shortTitle` in derselben Antwort wie `answer`
 * (zwei bis vier Worte, Zielsprache der Perspektive). Hier wird der rohe Wert
 * geprueft und bereinigt — reine Funktion, kein I/O (chat-contracts §1).
 *
 * Der Kurztitel ist Darstellung: Er gehoert NICHT in den Cache-Hash
 * (`createCacheHash` baut aus einer festen Feldliste, Test
 * `cache-key-utils.test.ts`) und nicht in den Query-Log-Vergleich.
 */

/** Hoechstlaenge; laengere Titel werden an der letzten Wortgrenze gekuerzt. */
export const SHORT_TITLE_MAX_CHARS = 60

/**
 * @returns den bereinigten Kurztitel oder `undefined`, wenn nichts Brauchbares
 *          kam (kein String, leer, nur Satzzeichen). Kein Platzhalter — die
 *          Chronik faellt dann sichtbar auf die Heuristik zurueck.
 */
export function normalizeShortTitle(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let text = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'„“‚‘«»]+|["'“”‘’«»]+$/gu, '')
    .replace(/[.!?:;,…]+$/u, '')
    .trim()
  if (text === '') return undefined
  if (text.length > SHORT_TITLE_MAX_CHARS) {
    const schnitt = text.lastIndexOf(' ', SHORT_TITLE_MAX_CHARS - 1)
    text = `${text.slice(0, schnitt > 0 ? schnitt : SHORT_TITLE_MAX_CHARS).trimEnd()}…`
  }
  return text
}
