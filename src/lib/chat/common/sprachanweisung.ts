/**
 * @fileoverview Sprachanweisung des Chat-Prompts und Sprachschutz fuer den Verlauf.
 *
 * Befund 10.11.2026: Nach einem Wechsel der Antwortsprache (en → da → en) kam die
 * dritte Antwort weiter auf Daenisch. Der Client schickt die letzten Frage-Antwort-
 * Paare im Wortlaut mit; die daenische Antwort stand als assistant-Message direkt
 * vor der neuen Frage, die Sprachanweisung nur weit vorne in der System-Message
 * (und mit deutschem Sprachnamen: "Respond in Englisch."). Das Modell folgte dem
 * Verlauf. Drei Gegenmittel, alle hier:
 *
 * 1. Sprachname auf Englisch plus ISO-Code (`languageInstruction`).
 * 2. Wiederholung als letzte Anweisung vor dem Ausgabeformat (`languageReminder`).
 * 3. Antworten in anderer Sprache gehen nicht im Wortlaut in den Verlauf
 *    (`verlaufFuerSprache`); die Frage bleibt, damit Folgefragen Bezug behalten.
 */

import type { TargetLanguage } from '../constants'
import { isValidTargetLanguage } from '../constants'

type KonkreteSprache = Exclude<TargetLanguage, 'global'>

/** Englische Sprachnamen fuer den (englischen) Prompt — NICHT die UI-Labels. */
export const PROMPT_LANGUAGE_NAMES: Record<KonkreteSprache, string> = {
  de: 'German', en: 'English', it: 'Italian', fr: 'French', es: 'Spanish',
  pt: 'Portuguese', nl: 'Dutch', no: 'Norwegian', da: 'Danish', sv: 'Swedish',
  fi: 'Finnish', pl: 'Polish', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian',
  bg: 'Bulgarian', el: 'Greek', tr: 'Turkish', ru: 'Russian', uk: 'Ukrainian',
  zh: 'Chinese', ko: 'Korean', ja: 'Japanese', hr: 'Croatian', sr: 'Serbian',
  bs: 'Bosnian', sl: 'Slovenian', sk: 'Slovak', lt: 'Lithuanian', lv: 'Latvian',
  et: 'Estonian', id: 'Indonesian', ms: 'Malay', hi: 'Hindi', sw: 'Swahili',
  yo: 'Yoruba', zu: 'Zulu', am: 'Amharic', om: 'Oromo',
}

/** Platzhalter fuer eine Verlaufs-Antwort, die in anderer Sprache gegeben wurde. */
export const VERLAUF_ANTWORT_AUSGELASSEN =
  '[Earlier answer omitted: it was written in a different language than the one requested now.]'

/**
 * Loest die Zielsprache auf eine konkrete Sprache auf. 'global' folgt der
 * Oberflaeche; ohne (bekannte) UI-Locale bleibt es beim bisherigen Verhalten
 * Deutsch — das ist die dokumentierte Vorgabe des Prompts, kein neuer Fallback.
 */
export function promptSprache(targetLanguage: TargetLanguage | undefined, uiLocale?: string): KonkreteSprache {
  if (targetLanguage && targetLanguage !== 'global') return targetLanguage
  if (uiLocale && uiLocale !== 'global' && isValidTargetLanguage(uiLocale)) return uiLocale as KonkreteSprache
  return 'de'
}

/** "Respond in English (ISO 639-1: en)." — eindeutig, in der Sprache des Prompts. */
export function languageInstruction(targetLanguage: TargetLanguage | undefined, uiLocale?: string): string {
  const code = promptSprache(targetLanguage, uiLocale)
  return `Respond in ${PROMPT_LANGUAGE_NAMES[code]} (ISO 639-1: ${code}).`
}

/**
 * Wiederholung der Sprachanweisung fuer das Ende der User-Message: nach Quellen
 * und Verlauf, unmittelbar vor dem Ausgabeformat. Die Zielsprache der aktuellen
 * Anfrage gewinnt ausdruecklich gegen Verlauf, Frage und Quellen.
 */
export function languageReminder(targetLanguage: TargetLanguage | undefined, uiLocale?: string): string {
  const code = promptSprache(targetLanguage, uiLocale)
  const name = PROMPT_LANGUAGE_NAMES[code]
  return `Language (binding, overrides the language of earlier turns, of the question and of the sources):
- Write "answer", "suggestedQuestions" and "shortTitle" in ${name} (ISO 639-1: ${code}) — even if earlier answers in this conversation were written in another language.`
}

/** Ein Paar des Verlaufs; `targetLanguage` = Sprache, in der die Antwort verlangt war. */
export interface VerlaufsPaar {
  question: string
  answer: string
  targetLanguage?: string
}

/**
 * Nimmt Antworten aus dem Verlauf, die in einer ANDEREN Sprache verlangt waren
 * als die aktuelle Anfrage. Paare ohne Sprachangabe (aeltere Clients) bleiben
 * unveraendert — dort schuetzt die Wiederholung der Sprachanweisung.
 */
export function verlaufFuerSprache(
  history: VerlaufsPaar[] | undefined,
  targetLanguage: TargetLanguage | undefined,
  uiLocale?: string
): Array<{ question: string; answer: string }> {
  if (!history || history.length === 0) return []
  const aktuell = promptSprache(targetLanguage, uiLocale)
  return history.map((paar) => {
    const damals = paar.targetLanguage
    if (damals === undefined) return { question: paar.question, answer: paar.answer }
    if (!isValidTargetLanguage(damals)) {
      throw new Error(`Ungültige Sprache im Chat-Verlauf: "${damals}"`)
    }
    const gleich = promptSprache(damals, uiLocale) === aktuell
    return { question: paar.question, answer: gleich ? paar.answer : VERLAUF_ANTWORT_AUSGELASSEN }
  })
}
