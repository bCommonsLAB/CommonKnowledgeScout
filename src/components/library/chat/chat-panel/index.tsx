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
 * Seit D6c ist chat-panel.tsx nur noch der Chat-Reiter; die Story-Mitte
 * montiert `StoryRoot` aus `@ks/module-story` (story/story-root-mount.tsx).
 */

export { ChatPanel } from '../chat-panel'
export type { } from '../chat-panel'
