/**
 * Re-Export für settings/chat Modul.
 * Einstiegspunkt nach dem Modul-Split in Welle 3-IV-b.
 */

export { ChatForm } from './chat-form'
export { useChatForm, chatFormSchema } from './hooks/use-chat-form'
export type { ChatFormValues } from './hooks/use-chat-form'
