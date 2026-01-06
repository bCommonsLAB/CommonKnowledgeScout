/**
 * @fileoverview Normalisierung für suggestedQuestions aus LLM Structured Output
 *
 * @description
 * Einige Modelle liefern bei Structured Output manchmal weniger/mehr Items, Duplikate oder Leerstrings.
 * Um die UI stabil zu halten, normalisieren wir serverseitig auf genau 7 Vorschläge.
 *
 * Wichtig: Diese Normalisierung ist bewusst deterministisch und "low-magic".
 * Sie soll Schema-Validierungsfehler reduzieren und die UI konsistent halten,
 * ohne die LLM-Ausgabe stark zu verfälschen.
 */

export interface NormalizeSuggestedQuestionsArgs {
  suggestedQuestions: string[]
  seedQuestion: string
}

/**
 * Normalisiert `suggestedQuestions` auf genau 7 Einträge.
 *
 * Regeln:
 * - Trimmen, leere Strings entfernen
 * - Deduplizieren (case-sensitive, aber nach trim)
 * - Maximal 7 übernehmen
 * - Falls weniger als 7: mit deterministischen Fallback-Fragen auffüllen
 */
export function normalizeSuggestedQuestionsToSeven(
  args: NormalizeSuggestedQuestionsArgs
): string[] {
  const cleaned = args.suggestedQuestions.map(s => s.trim()).filter(Boolean)
  const unique = [...new Set(cleaned)]

  if (unique.length >= 7) return unique.slice(0, 7)

  const fallbacks = buildFallbackQuestions(args.seedQuestion)
  const out: string[] = [...unique]

  for (const candidate of fallbacks) {
    if (out.length >= 7) break
    if (!out.includes(candidate)) out.push(candidate)
  }

  // Letztes Sicherheitsnetz: niemals < 7 zurückgeben (UI erwartet 7)
  while (out.length < 7) {
    out.push(out[out.length - 1] ?? 'Mehr dazu?')
  }

  return out.slice(0, 7)
}

function buildFallbackQuestions(seedQuestion: string): string[] {
  const seed = seedQuestion.trim()
  const safeSeed = seed.length > 0 ? seed : 'dieses Thema'

  // Kurze, allgemeine Fragen – bewusst ohne Annahmen über Domain/Quellen.
  return [
    `Kannst du ${safeSeed} in einfachen Worten erklären?`,
    `Welche Beispiele gibt es zu ${safeSeed}?`,
    `Was sind die wichtigsten Begriffe rund um ${safeSeed}?`,
    `Welche Vorteile und Nachteile hat ${safeSeed}?`,
    `Welche Risiken, Grenzen oder offenen Fragen gibt es bei ${safeSeed}?`,
    `Wie kann man ${safeSeed} praktisch anwenden?`,
    `Welche nächsten Schritte empfiehlst du, um ${safeSeed} weiter zu verstehen?`,
    `Woran erkennt man gute vs. schlechte Umsetzungen von ${safeSeed}?`,
    `Welche Alternativen oder verwandten Ansätze gibt es zu ${safeSeed}?`,
  ]
}









