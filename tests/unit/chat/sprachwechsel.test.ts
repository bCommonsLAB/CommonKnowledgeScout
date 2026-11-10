/**
 * Regression Sprachwechsel (Befund 10.11.2026): Folge en → da → en in EINER
 * Sitzung. Die dritte Antwort kam auf Daenisch, weil die daenische Antwort im
 * Wortlaut als assistant-Message vor der neuen Frage stand und die
 * Sprachanweisung nur in der System-Message ("Respond in Englisch.").
 */

import { describe, expect, it } from 'vitest'
import { buildChatMessages } from '@/lib/chat/common/prompt'
import {
  languageInstruction,
  promptSprache,
  verlaufFuerSprache,
  VERLAUF_ANTWORT_AUSGELASSEN,
} from '@/lib/chat/common/sprachanweisung'

const FRAGE = 'How can Europe become digitally sovereign with free software?'
const ANTWORT_EN = 'SFSCON offers several talks on digital sovereignty …'
const ANTWORT_DA = 'SFSCON tilbyder flere foredrag om digital suverænitet …'

/** Der Verlauf, wie ihn der Client bei der dritten Anfrage schickt. */
const VERLAUF = [
  { question: FRAGE, answer: ANTWORT_EN, targetLanguage: 'en' },
  { question: FRAGE, answer: ANTWORT_DA, targetLanguage: 'da' },
]

describe('Sprachanweisung', () => {
  it('nennt die Sprache englisch und mit ISO-Code — nicht "Englisch"', () => {
    expect(languageInstruction('en')).toBe('Respond in English (ISO 639-1: en).')
    expect(languageInstruction('da')).toBe('Respond in Danish (ISO 639-1: da).')
  })

  it('"global" folgt der UI-Locale, ohne Locale bleibt es bei Deutsch', () => {
    expect(promptSprache('global', 'it')).toBe('it')
    expect(promptSprache('global')).toBe('de')
    expect(promptSprache('en', 'it')).toBe('en')
  })
})

describe('Folge en → da → en', () => {
  const dritte = buildChatMessages(FRAGE, [], 'mittel', { targetLanguage: 'en', chatHistory: VERLAUF })
  const gesamt = dritte.map((m) => m.content).join('\n')

  it('schickt die daenische Antwort NICHT im Wortlaut mit', () => {
    expect(gesamt).not.toContain(ANTWORT_DA)
    expect(dritte.filter((m) => m.role === 'assistant').map((m) => m.content)).toEqual([
      ANTWORT_EN,
      VERLAUF_ANTWORT_AUSGELASSEN,
    ])
  })

  it('behaelt die frueheren Fragen (Bezug fuer Folgefragen)', () => {
    expect(dritte.filter((m) => m.role === 'user')).toHaveLength(3)
  })

  it('wiederholt die Zielsprache als letzte Anweisung vor dem Ausgabeformat', () => {
    const letzte = dritte[dritte.length - 1]
    expect(letzte.role).toBe('user')
    const sprache = letzte.content.indexOf('English (ISO 639-1: en)')
    expect(sprache).toBeGreaterThan(letzte.content.indexOf('Sources:'))
    expect(sprache).toBeLessThan(letzte.content.indexOf('Output Format:'))
    expect(letzte.content).not.toContain('Danish')
  })

  it('die zweite Anfrage (da) behaelt keine englische Antwort im Wortlaut', () => {
    const zweite = buildChatMessages(FRAGE, [], 'mittel', { targetLanguage: 'da', chatHistory: VERLAUF.slice(0, 1) })
    expect(zweite.map((m) => m.content).join('\n')).not.toContain(ANTWORT_EN)
    expect(zweite[0].content).toContain('Respond in Danish (ISO 639-1: da).')
  })
})

describe('verlaufFuerSprache', () => {
  it('laesst Paare ohne Sprachangabe (aeltere Clients) unveraendert', () => {
    expect(verlaufFuerSprache([{ question: 'q', answer: 'a' }], 'en')).toEqual([{ question: 'q', answer: 'a' }])
  })

  it('"global" im Verlauf zaehlt als die Sprache der Oberflaeche', () => {
    const paar = [{ question: 'q', answer: 'a', targetLanguage: 'global' }]
    expect(verlaufFuerSprache(paar, 'en', 'en')[0].answer).toBe('a')
    expect(verlaufFuerSprache(paar, 'da', 'en')[0].answer).toBe(VERLAUF_ANTWORT_AUSGELASSEN)
  })

  it('wirft bei unbekannter Sprache im Verlauf statt still weiterzumachen', () => {
    expect(() => verlaufFuerSprache([{ question: 'q', answer: 'a', targetLanguage: 'xx' }], 'en')).toThrow(/xx/)
  })
})
