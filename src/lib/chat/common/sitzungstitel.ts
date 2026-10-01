/**
 * Sitzungstitel (Chat-Titel) im Story-Modus.
 *
 * Eine Sitzung entsteht heute mit der ersten Anfrage ohne `chatId` — im
 * Story-Modus ist das die Themenuebersicht (`TOC_QUESTION`), nicht eine Frage
 * der Person. Der Chat traegt dann die englische Systemfrage als Titel, und
 * die Chronik (D1, Plan `story-dreiteilung-fragenchronik`) zeigt ihn so an.
 *
 * Regel: Die erste echte Frage gibt der Sitzung ihren Titel (Plan: „Die erste
 * Frage eroeffnet eine neue Sitzung"). Ab D5 ersetzt das Sprachmodell den
 * Titel durch einen Kurztitel.
 */

import { TOC_QUESTION } from '@/lib/chat/constants'

/** Hoechstlaenge, auf die `createChat` Titel kuerzt. */
export const SITZUNGSTITEL_MAX = 60

/** Traegt der Chat noch den Systemtitel der Themenuebersicht? */
export function istThemenuebersichtTitel(title: string): boolean {
  return title.trim() === TOC_QUESTION.slice(0, SITZUNGSTITEL_MAX).trim()
}

/** Titel aus einer Frage, wie `createChat` ihn bildet. */
export function sitzungstitelAusFrage(frage: string): string {
  return frage.trim().slice(0, SITZUNGSTITEL_MAX)
}
