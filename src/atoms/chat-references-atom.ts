import { atom } from 'jotai'
import type { ChatResponse } from '@/types/chat-response'

/**
 * Atom für die aktuellen Chat-Referenzen, die in der Gallery angezeigt werden sollen
 * Enthält auch queryId, um sources aus QueryLog laden zu können
 */
export const chatReferencesAtom = atom<{
  references: ChatResponse['references']
  queryId?: string
}>({ references: [] })

