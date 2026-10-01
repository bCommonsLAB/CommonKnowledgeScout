/**
 * Beim ersten Laden eines Verlaufs alle Konversationen aufklappen (D6, aus
 * chat-panel.tsx ausgegliedert). Danach kann die Person sie schliessen; ein
 * Wechsel der Sitzung setzt die Markierung zurueck. Verhalten 1:1 portiert.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ChatMessage } from '../../utils/chat-utils'

export interface UseOpenConversationsOnLoadParams {
  messages: ChatMessage[]
  activeChatId: string | null
  setOpenConversations: Dispatch<SetStateAction<Set<string>>>
}

export function useOpenConversationsOnLoad({ messages, activeChatId, setOpenConversations }: UseOpenConversationsOnLoadParams): void {
  // Welche Sitzung schon initial geoeffnet wurde — verhindert Wiederoeffnen nach dem Zuklappen.
  const historyInitializedRef = useRef<string | null>(null)

  useEffect(() => {
    if (activeChatId && historyInitializedRef.current !== activeChatId && messages.length > 0) {
      historyInitializedRef.current = activeChatId
      // Dieselbe Kennung wie in groupMessagesToConversations, damit die IDs zusammenpassen.
      const conversations: string[] = []
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        if (msg.type === 'question' && msg.queryId) {
          const conversationId = msg.queryId ? `${msg.queryId}-${msg.id}` : msg.id.replace('-question', '') || `conv-${i}`
          conversations.push(conversationId)
        }
      }
      if (conversations.length > 0) setOpenConversations(new Set(conversations))
    }
  }, [messages, activeChatId, setOpenConversations])

  useEffect(() => {
    if (!activeChatId) historyInitializedRef.current = null
  }, [activeChatId])
}
