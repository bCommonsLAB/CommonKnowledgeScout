/**
 * Sitzungstitel (Chat-Titel) im Story-Modus.
 *
 * Seit D8 (Sitzungsstart, Plan `story-dreiteilung-fragenchronik`) eroeffnet
 * die Themenuebersicht (`TOC_QUESTION`) KEINE Sitzung mehr: Erst die erste
 * Frage der Person legt den Chat an, ihr Text ist der erste Titel, ab D5
 * ersetzt das Sprachmodell ihn durch einen Kurztitel.
 *
 * Vor D8 trug jede von der Uebersicht eroeffnete Sitzung die englische
 * Systemfrage als Titel. `istThemenuebersichtTitel` erkennt diese Altlasten —
 * `scripts/cleanup-toc-chats.ts` loescht sie.
 */

import { TOC_QUESTION } from '@/lib/chat/constants'

/** Hoechstlaenge, auf die `createChat` Titel kuerzt. */
export const SITZUNGSTITEL_MAX = 60

/** Traegt der Chat noch den Systemtitel der Themenuebersicht (vor D8)? */
export function istThemenuebersichtTitel(title: string): boolean {
  return title.trim() === TOC_QUESTION.slice(0, SITZUNGSTITEL_MAX).trim()
}
