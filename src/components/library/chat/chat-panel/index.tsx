"use client"

/**
 * Composer-Fassade fuer ChatPanel (Welle 3-III-b).
 *
 * Exportiert ChatPanel unter dem alten Namen, sodass alle Konsumenten
 * ihre Imports unveraendert lassen koennen:
 *   import { ChatPanel } from '@/components/library/chat/chat-panel'
 *
 * Sub-Module unter chat-panel/:
 *   hooks/use-active-chat-id.ts  — localStorage-Persistenz fuer activeChatId
 *
 * Zielzustand (Welle 3-III-c oder spaeter):
 *   index.tsx   → Composer: State-Hooks + Layout (< 150 Zeilen)
 *   panel-header.tsx → ChatConfigBar + ChatConfigPopover
 *   panel-body.tsx   → ScrollArea + ChatMessagesList + StoryTopics
 *   panel-footer.tsx → ChatInput + FloatingButton
 *
 * Aktuell: chat-panel.tsx ist noch ein Monolith (1267 Zeilen).
 * Diese Datei stellt den Composer-Vertrag bereit ohne den
 * Modul-Split zu erzwingen (Zeilen-Budget 1.000z/Commit einhalten).
 */

export { ChatPanel } from '../chat-panel'
export type { } from '../chat-panel'
