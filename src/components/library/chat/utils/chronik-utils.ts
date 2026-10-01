/**
 * Reine Helfer zwischen Chat-Verlauf (ChatMessage[]) und Story-Chronik (D1).
 *
 * Der Verlauf kennt Frage- und Antwort-Nachrichten; die Chronik kennt Fragen
 * mit Zustand, die Mitte zeigt genau eine Konversation. Hier wird uebersetzt,
 * ohne Chat-Logik anzufassen.
 */

import type { ChronikFrage, StoryAuswahl } from '@ks/module-story/react'
import { groupMessagesToConversations, type ChatMessage } from './chat-utils'

/**
 * Fragen der aktiven Sitzung aus dem Verlauf, chronologisch, mit Zustand
 * „offen" (D2: „laeuft"). Offen ist nur die letzte Frage ohne Antwort,
 * solange der Stream laeuft — eine abgebrochene Frage (Fehler) bleibt im
 * Verlauf ohne Antwort und darf nicht ewig als „laeuft" stehen.
 */
export function fragenAusVerlauf(messages: ChatMessage[], laeuft: boolean): ChronikFrage[] {
  const paare = groupMessagesToConversations(messages)
  return paare.map((paar, i) => ({
    queryId: paar.question.queryId,
    frageId: paar.question.id,
    text: paar.question.content,
    createdAt: paar.question.createdAt,
    offen: laeuft && i === paare.length - 1 && paar.answer === undefined,
  }))
}

/** Die Frage-Nachricht, die eine Konversations-Auswahl meint — oder `null`. */
export function frageZurAuswahl(messages: ChatMessage[], auswahl: StoryAuswahl): ChatMessage | null {
  if (auswahl.art !== 'konversation') return null
  const frage = messages.find(
    (m) =>
      m.type === 'question' &&
      ((auswahl.frageId !== undefined && m.id === auswahl.frageId) ||
        (auswahl.queryId !== undefined && m.queryId === auswahl.queryId)),
  )
  return frage ?? null
}

/**
 * Nur die Nachrichten der gewaehlten Konversation: die Frage und ihre Antwort.
 * Solange die Antwort laeuft, hat die Frage noch keine queryId — dann zaehlt
 * die lokale Kennung; sobald sie da ist, haengt die Antwort ueber die queryId.
 */
export function konversationAuswaehlen(messages: ChatMessage[], auswahl: StoryAuswahl): ChatMessage[] {
  const frage = frageZurAuswahl(messages, auswahl)
  if (!frage) return []
  return messages.filter((m) => m === frage || (frage.queryId !== undefined && m.queryId === frage.queryId))
}

/**
 * Ist mit dem letzten Schritt genau eine neue Frage dazugekommen (die Person
 * hat gesendet)? Dann wird sie die aktive Konversation. Ein Verlaufs-Laden
 * bringt viele Nachrichten auf einmal und loest das nicht aus.
 */
export function neueFrage(vorher: number, messages: ChatMessage[]): ChatMessage | null {
  if (messages.length !== vorher + 1) return null
  const letzte = messages[messages.length - 1]
  return letzte.type === 'question' ? letzte : null
}
