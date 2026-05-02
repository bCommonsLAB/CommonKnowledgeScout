/**
 * Re-Export fuer Abwaertskompatibilitaet.
 *
 * Die eigentliche Implementierung wurde nach `use-chat-toc/` verschoben
 * (Welle 3-III-b). Konsumenten, die `./hooks/use-chat-toc` importieren,
 * erhalten weiterhin denselben Export.
 */
export { useChatTOC } from './use-chat-toc/index'
export type { UseChatTOCParams, UseChatTOCResult, CachedTOC } from './use-chat-toc/types'
