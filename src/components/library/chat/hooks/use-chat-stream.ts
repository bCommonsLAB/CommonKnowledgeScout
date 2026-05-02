/**
 * Re-Export fuer Abwaertskompatibilitaet.
 *
 * Die eigentliche Implementierung wurde nach `use-chat-stream/` verschoben
 * (Welle 3-III-b). Konsumenten, die `./hooks/use-chat-stream` importieren,
 * erhalten weiterhin denselben Export.
 */
export { useChatStream } from './use-chat-stream/index'
export type { UseChatStreamParams, UseChatStreamResult } from './use-chat-stream/types'
