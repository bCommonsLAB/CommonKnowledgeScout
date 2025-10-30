import { atom } from 'jotai'
import type { ChatResponse } from '@/types/chat-response'

/**
 * Atom für die aktuellen Chat-Referenzen, die in der Gallery angezeigt werden sollen
 */
export const chatReferencesAtom = atom<ChatResponse['references']>([])

