/**
 * Wer darf ein Query-Log lesen? (Story D12a)
 *
 * Fragen einer Person gehoeren ihr: Lesen nur mit derselben `userEmail`
 * bzw. derselben anonymen `sessionId`. Die Themenuebersicht (`toc`) ist
 * anders: ihr Cache ist benutzeruebergreifend (Hash + Library), der
 * `complete`-Schritt traegt deshalb oft die Kennung eines Logs, das eine
 * andere Person angelegt hat. Konfig-Anzeige, Protokoll und Quellen der
 * Uebersicht liefen damit auf 404 (Befund 02.10., Testplan Schritt 2).
 *
 * Regel: Ein `toc`-Log ist innerhalb seiner Library fuer alle lesbar —
 * ohne `userEmail` und `sessionId` des Erstellers, wenn es nicht das eigene
 * ist. Alles andere bleibt an die Person gebunden.
 */

import type { QueryLog } from '@/types/query-log'

export interface QueryLogLeser {
  userEmail?: string
  sessionId?: string
}

/** Themenuebersicht? Neue Logs tragen den Typ in `cacheParams`, alte in der Wurzel. */
export function istUebersichtsLog(log: Pick<QueryLog, 'queryType' | 'cacheParams'>): boolean {
  return (log.cacheParams?.queryType ?? log.queryType) === 'toc'
}

/** Eigenes Log: dieselbe Person (E-Mail) bzw. dieselbe anonyme Sitzung. */
export function istEigenesLog(log: Pick<QueryLog, 'userEmail' | 'sessionId'>, leser: QueryLogLeser): boolean {
  if (leser.userEmail) return log.userEmail === leser.userEmail
  if (leser.sessionId) return log.sessionId === leser.sessionId
  return false
}

/**
 * Das Log, wie die lesende Person es sehen darf — oder `null`, wenn sie es
 * nicht sehen darf. Fremde Uebersichts-Logs kommen ohne Erstellerdaten.
 */
export function logFuerLeser(log: QueryLog, leser: QueryLogLeser): QueryLog | null {
  if (!leser.userEmail && !leser.sessionId) {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  if (istEigenesLog(log, leser)) return log
  if (!istUebersichtsLog(log)) return null
  const { userEmail: _userEmail, sessionId: _sessionId, ...ohneErsteller } = log
  return ohneErsteller
}
