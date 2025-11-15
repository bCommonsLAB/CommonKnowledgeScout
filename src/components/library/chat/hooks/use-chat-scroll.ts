import { useEffect, RefObject } from 'react'
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
  // Auto-Scroll zum neuesten Accordion (nur bei neuen Nachrichten)
  useEffect(() => {
    // Scroll nur, wenn neue Nachrichten hinzugefügt wurden
    if (messages.length <= prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length
      return
    }
    prevMessagesLengthRef.current = messages.length

    // Prüfe, ob es ein neues geöffnetes Accordion gibt
    const conversations = groupMessagesToConversations(messages)
    const lastConversation = conversations[conversations.length - 1]
    if (lastConversation && openConversations.has(lastConversation.conversationId)) {
      setTimeout(() => {
        // Prüfe mehrfach, ob Element existiert (für ältere Geräte mit langsamerem Rendering)
        const tryScroll = (attempts = 0) => {
          const element = document.querySelector(`[data-conversation-id="${lastConversation.conversationId}"]`)
          if (element && element.parentElement && element.parentElement.contains(element)) {
            try {
              element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            } catch (error) {
              // Ignoriere Scroll-Fehler auf älteren Geräten
              console.debug('[useChatScroll] Scroll-Fehler ignoriert:', error)
            }
          } else if (attempts < 3) {
            // Versuche es nochmal nach kurzer Verzögerung
            setTimeout(() => tryScroll(attempts + 1), 200)
          }
        }
        tryScroll()
      }, 500)
    }
  }, [messages, openConversations, prevMessagesLengthRef])

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
  useEffect(() => {
    // Prüfe, ob es eine neue Antwort gibt
    const conversations = groupMessagesToConversations(messages)
    const lastConversation = conversations[conversations.length - 1]
    
    if (lastConversation?.answer) {
      // Öffne automatisch das neueste Accordion, wenn eine Antwort vorhanden ist
      if (!openConversations.has(lastConversation.conversationId)) {
        setOpenConversations(prev => new Set([...prev, lastConversation.conversationId]))
      }
      
      // Scroll zum Anfang der Antwort nach kurzer Verzögerung, damit die Antwort gerendert ist
      setTimeout(() => {
        const scrollToAnswerStart = (attempts = 0) => {
          // Finde das Conversation-Element
          const conversationElement = document.querySelector(`[data-conversation-id="${lastConversation.conversationId}"]`)
          if (conversationElement && conversationElement.parentElement && conversationElement.parentElement.contains(conversationElement)) {
            try {
              // Finde das AccordionContent innerhalb des Conversation-Elements
              // AccordionContent hat das role="region" Attribut von Radix UI
              const accordionContent = conversationElement.querySelector('[role="region"]')
              if (accordionContent && accordionContent.parentElement && accordionContent.parentElement.contains(accordionContent)) {
                // Scroll zum Anfang des AccordionContent (wo die Antwort beginnt)
                accordionContent.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'start',
                  inline: 'nearest'
                })
              } else {
                // Fallback: Scroll zum Conversation-Element selbst
                conversationElement.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'start',
                  inline: 'nearest'
                })
              }
            } catch (error) {
              // Ignoriere Scroll-Fehler auf älteren Geräten
              console.debug('[useChatScroll] Scroll-Fehler ignoriert:', error)
            }
          } else if (attempts < 3) {
            // Versuche es nochmal nach kurzer Verzögerung
            setTimeout(() => scrollToAnswerStart(attempts + 1), 200)
          }
        }
        scrollToAnswerStart()
        // Nochmal nach kurzer Verzögerung für vollständiges Rendering
        setTimeout(() => scrollToAnswerStart(1), 500)
      }, 200)
    }
  }, [messages, openConversations, setOpenConversations])
}

