/**
 * Heuristischer Kurztitel einer Frage: die ersten Worte.
 *
 * D1-Regel aus dem Plan; seit D5 liefert das Sprachmodell einen Kurztitel
 * (`shortTitle` am QueryLog, in der Chronik `kurztitel`), die Heuristik
 * bleibt fuer alte Eintraege — `kurztitelFuer` entscheidet.
 */

const MAX_WORTE = 5
const MAX_ZEICHEN = 40

/** Fuehrende Fragewoerter, die ohne Verlust wegfallen koennen (de/en/it). */
const FUELLWOERTER = new Set([
  'was', 'wie', 'wer', 'wo', 'wann', 'warum', 'welche', 'welcher', 'welches', 'gibt', 'es',
  'what', 'how', 'who', 'where', 'when', 'why', 'which', 'is', 'are', 'does', 'do',
  'cosa', 'come', 'chi', 'dove', 'quando', 'perché', 'quali', 'quale',
])

/**
 * @returns zwei bis fuenf Worte, hoechstens 40 Zeichen, ohne Satzzeichen am
 *          Ende; bei gekuerztem Text mit „…". Leerer Text bleibt leer.
 */
export function kurztitel(frage: string): string {
  const worte = frage.trim().split(/\s+/).filter((w) => w.length > 0)
  if (worte.length === 0) return ''

  // Fuehrende Fuellwoerter weglassen — solange danach mehr als drei Worte bleiben.
  let start = 0
  while (worte.length - start > 3 && FUELLWOERTER.has(worte[start].toLowerCase())) start++
  const kern = worte.slice(start)

  const gewaehlt: string[] = []
  let laenge = 0
  for (const wort of kern) {
    if (gewaehlt.length >= MAX_WORTE) break
    if (gewaehlt.length >= 2 && laenge + 1 + wort.length > MAX_ZEICHEN) break
    gewaehlt.push(wort)
    laenge += (gewaehlt.length > 1 ? 1 : 0) + wort.length
  }

  const gekuerzt = gewaehlt.length < kern.length
  const text = gewaehlt.join(' ').replace(/[?!.,;:…]+$/u, '')
  return gekuerzt ? `${text}…` : text
}

/** Kurztitel einer Chronik-Frage: der vom Sprachmodell, sonst die Heuristik. */
export function kurztitelFuer(frage: { text: string; kurztitel?: string }): string {
  return frage.kurztitel !== undefined && frage.kurztitel.trim() !== '' ? frage.kurztitel : kurztitel(frage.text)
}
