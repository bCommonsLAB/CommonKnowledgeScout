import { useEffect, useRef, RefObject } from 'react'
import type { ChatMessage } from '../utils/chat-utils'
import { groupMessagesToConversations } from '../utils/chat-utils'
import type { ChatProcessingStep } from '@/types/chat-processing'

interface UseChatScrollProps {
  scrollRef: RefObject<HTMLDivElement>
  messages: ChatMessage[]
  openConversations: Set<string>
  setOpenConversations: React.Dispatch<React.SetStateAction<Set<string>>>
  isSending: boolean
  processingSteps: ChatProcessingStep[]
  prevMessagesLengthRef: React.MutableRefObject<number>
}

/**
 * Custom Hook für Auto-Scroll-Logik im ChatPanel
 * 
 * Verwaltet automatisches Scrollen zu:
 * - Neuesten Nachrichten
 * - Verarbeitungsstatus während des Sendens
 * - Anfang der Antworten
 */
export function useChatScroll({
  scrollRef,
  messages,
  openConversations,
  setOpenConversations,
  isSending,
  processingSteps,
  prevMessagesLengthRef,
}: UseChatScrollProps) {
  // Auto-Scroll zum neuesten Accordion wurde deaktiviert - Benutzer möchte nicht automatisch scrollen
  // Aktualisiere nur prevMessagesLengthRef, damit andere Logik weiterhin funktioniert
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]) // prevMessagesLengthRef ist ein Ref und muss nicht in Dependencies sein

  // Auto-Scroll beim Start des Sendens (wenn Frage hinzugefügt wird)
  useEffect(() => {
    if (!isSending) return
    
    // Scroll zum Ende, wenn eine Frage gesendet wird
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth'
          })
        }
      }
    }
    
    // Scroll sofort und nochmal nach kurzer Verzögerung
    scrollToBottom()
    setTimeout(scrollToBottom, 200)
  }, [isSending, scrollRef])

  // Auto-Scroll während der Verarbeitung (Processing Steps)
  useEffect(() => {
    if (!isSending || processingSteps.length === 0) return
    
    // Scroll zum Ende des Scroll-Bereichs, damit Processing-Status sichtbar ist
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth'
          })
        }
      }
    }
    
    // Scroll sofort und dann nochmal nach kurzer Verzögerung für Updates
    scrollToBottom()
    const timeoutId = setTimeout(scrollToBottom, 300)
    
    return () => clearTimeout(timeoutId)
  }, [isSending, processingSteps, scrollRef])

  // Auto-Scroll wenn neue Antworten hinzugefügt werden - scrollt zum Anfang der Antwort
  // Öffne nur, wenn die Antwort wirklich neu ist und noch nie automatisch geöffnet wurde
  const openedAnswersRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    // Prüfe, ob es eine neue Antwort gibt
    const conversations = groupMessagesToConversations(messages)
    const lastConversation = conversations[conversations.length - 1]
    
    if (lastConversation?.answer) {
      const answerId = lastConversation.answer.id
      const answerMessageIndex = messages.findIndex(m => m.id === answerId)
      const isNewlyAdded = answerMessageIndex === messages.length - 1
      const isFromHistory = lastConversation.answer.queryId && !isNewlyAdded

      // Nur öffnen, wenn Antwort neu ist und noch nicht automatisch geöffnet wurde
      const shouldAutoOpen = isNewlyAdded && !isFromHistory && !openedAnswersRef.current.has(answerId)

      if (shouldAutoOpen && !openConversations.has(lastConversation.conversationId)) {
        openedAnswersRef.current.add(answerId)
        setOpenConversations(prev => new Set([...prev, lastConversation.conversationId]))
      }
      
      // Auto-Scroll wurde deaktiviert - Benutzer möchte nicht automatisch scrollen
    }
  }, [messages, openConversations, setOpenConversations])
}

