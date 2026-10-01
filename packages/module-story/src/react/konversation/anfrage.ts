/**
 * Die Anfrage an den Chat-Stream bauen (D6b): Adresse mit Perspektive,
 * Modell, Filter und Retriever; Koerper mit Frage, Antwortlaenge, Verlauf
 * (bis fuenf Paare) und Sitzung. Reine Funktionen, getrennt vom Hook, damit
 * sie ohne React pruefbar sind.
 */

import type { AnfrageRahmen, Nachricht } from './types'
import { paare } from './verlauf'

/** Temperatur wie in der App (`use-chat-stream`): fest 0.3, der Server verlangt sie ausdruecklich. */
const TEMPERATUR = '0.3'

export function streamAdresse(libraryId: string, rahmen: AnfrageRahmen): string {
  const p = new URLSearchParams()
  for (const [k, werte] of Object.entries(rahmen.filter ?? {})) {
    if (Array.isArray(werte)) for (const v of werte) p.append(k, String(v))
  }
  const { perspektive } = rahmen
  p.set('targetLanguage', perspektive.targetLanguage)
  p.set('character', perspektive.character.join(','))
  p.set('accessPerspective', perspektive.accessPerspective.join(','))
  p.set('socialContext', perspektive.socialContext)
  p.set('genderInclusive', String(perspektive.genderInclusive))
  p.set('llmModel', perspektive.llmModel)
  p.set('llmTemperature', TEMPERATUR)
  return `/api/chat/${encodeURIComponent(libraryId)}/stream?${p.toString()}`
}

export interface StreamKoerper {
  message: string
  answerLength: string
  chatHistory?: Array<{ question: string; answer: string }>
  chatId?: string
  asTOC?: true
  skipQueryCache?: true
}

/** Letzte fuenf vollstaendige Paare als Gespraechsverlauf fuer den Server. */
export function gespraechsverlauf(nachrichten: Nachricht[]): Array<{ question: string; answer: string }> {
  return paare(nachrichten)
    .filter((p): p is Required<typeof p> => p.antwort !== undefined)
    .slice(-5)
    .map((p) => ({ question: p.frage.text, answer: p.antwort.text }))
}

export function streamKoerper(
  frage: string,
  rahmen: AnfrageRahmen,
  nachrichten: Nachricht[],
  opts: { alsUebersicht?: boolean; ohneCache?: boolean } = {},
): StreamKoerper {
  const verlauf = gespraechsverlauf(nachrichten)
  return {
    message: frage,
    answerLength: rahmen.antwortLaenge,
    ...(verlauf.length > 0 ? { chatHistory: verlauf } : {}),
    ...(rahmen.chatId ? { chatId: rahmen.chatId } : {}),
    ...(opts.alsUebersicht ? { asTOC: true as const } : {}),
    ...(opts.ohneCache ? { skipQueryCache: true as const } : {}),
  }
}

/** Fehlertext fuer die Oberflaeche: ohne Schluessel, nicht endlos (wie `formatChatError` der App). */
export function fehlerText(roh: string): string {
  if (roh.includes('invalid_api_key') || roh.includes('Incorrect API key') || (roh.includes('401') && roh.includes('API key'))) {
    return 'Ungültiger API-Schlüssel der Library — bitte in den Einstellungen prüfen.'
  }
  const ohneSchluessel = roh.replace(/sk-proj-\*{50,}/g, 'sk-proj-***')
  return ohneSchluessel.length > 200 ? `${ohneSchluessel.slice(0, 197)}...` : ohneSchluessel
}
