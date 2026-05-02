/**
 * Modul-Einstiegspunkt fuer use-chat-stream.
 *
 * Exportiert den Hook und alle Typen. Konsumenten importieren wie bisher:
 *   import { useChatStream } from './hooks/use-chat-stream'
 *
 * Interne Struktur:
 *   index.ts        → Hook-Implementierung + Re-Exporte
 *   types.ts        → Parameter- und Ergebnis-Interfaces (testbar ohne DOM)
 *
 * Welle 3-III-b: Modul-Split aus use-chat-stream.ts (491z → modular).
 */

export { useChatStream } from './hook'
export type { UseChatStreamParams, UseChatStreamResult } from './types'
