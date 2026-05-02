/**
 * Modul-Einstiegspunkt fuer use-chat-toc.
 *
 * Exportiert Hook und Typen. Konsumenten importieren wie bisher:
 *   import { useChatTOC } from './hooks/use-chat-toc'
 *
 * Welle 3-III-b: Modul-Split aus use-chat-toc.ts (327z → modular).
 */

export { useChatTOC } from './hook'
export type { UseChatTOCParams, UseChatTOCResult, CachedTOC } from './types'
