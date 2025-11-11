/**
 * Hook für Chat-Stream-Verarbeitung
 * 
 * Verwaltet das Senden von Fragen, SSE-Stream-Verarbeitung und Step-Management.
 * Wird nur im Chat verwendet.
 */

import { useState, useCallback } from 'react'
import type { ChatProcessingStep } from '@/types/chat-processing'
import type { ChatMessage } from '../utils/chat-utils'
import type { ChatResponse } from '@/types/chat-response'
import type { StoryTopicsData } from '@/types/story-topics'
import type { AnswerLength, Retriever, TargetLanguage, Character, SocialContext } from '@/lib/chat/constants'
import { TOC_QUESTION } from '@/lib/chat/constants'
import type { GalleryFilters } from '@/atoms/gallery-filters'
import { parseSSELines } from '@/utils/sse'
import { formatChatError } from '@/utils/error-format'
import { useSessionHeaders } from '@/hooks/use-session-headers'

interface UseChatStreamParams {
  libraryId: string
  cfg: {
    config: {
      maxChars?: number
      maxCharsWarningMessage?: string
    }
  } | null
  messages: ChatMessage[]
  activeChatId: string | null
  retriever: Retriever
  answerLength: AnswerLength
  targetLanguage: TargetLanguage
  character: Character
  socialContext: SocialContext
  genderInclusive: boolean
  galleryFilters?: GalleryFilters
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setActiveChatId: (id: string | null) => void
  setOpenConversations: (convs: Set<string>) => void
  setChatReferences: (refs: ChatResponse['references']) => void
  onTOCComplete?: (data: {
    storyTopicsData?: StoryTopicsData
    answer: string
    references: ChatResponse['references']
    suggestedQuestions: string[]
    queryId: string
  }) => void
  onError?: (error: string) => void
}

interface UseChatStreamResult {
  isSending: boolean
  processingSteps: ChatProcessingStep[]
  sendQuestion: (
    questionText: string,
    retrieverOverride?: Retriever,
    isTOCQuery?: boolean,
    asTOC?: boolean
  ) => Promise<void>
  setProcessingSteps: React.Dispatch<React.SetStateAction<ChatProcessingStep[]>>
}

/**
 * Hook für Chat-Stream-Verarbeitung
 * 
 * @param params - Parameter für Stream-Verarbeitung
 * @returns Sending-Status, Steps und Send-Funktion
 */
export function useChatStream(params: UseChatStreamParams): UseChatStreamResult {
  const {
    libraryId,
    cfg,
    messages,
    activeChatId,
    retriever,
    answerLength,
    targetLanguage,
    character,
    socialContext,
    genderInclusive,
    galleryFilters,
    setMessages,
    setActiveChatId,
    setOpenConversations,
    setChatReferences,
    onTOCComplete,
    onError,
  } = params

  const [isSending, setIsSending] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ChatProcessingStep[]>([])
  const sessionHeaders = useSessionHeaders()

  const sendQuestion = useCallback(
    async (
      questionText: string,
      retrieverOverride?: Retriever,
      isTOCQuery = false,
      asTOC = false
    ): Promise<void> => {
      if (!cfg) return
      if (isSending) return // Verhindere doppelte Anfragen
      if (cfg.config.maxChars && questionText.length > cfg.config.maxChars) {
        const errorMsg = cfg.config.maxCharsWarningMessage || 'Eingabe zu lang'
        onError?.(errorMsg)
        return
      }

      setIsSending(true)
      setProcessingSteps([])

      // Für TOC-Queries: Nicht als normale Message hinzufügen
      const isTOC = isTOCQuery || questionText.trim() === TOC_QUESTION.trim()

      // Prüfe, ob diese Frage bereits vorhanden ist (nur für normale Fragen)
      if (!isTOC) {
        const alreadyExists = messages.some(
          (msg) => msg.type === 'question' && msg.content.trim() === questionText.trim()
        )

        if (alreadyExists) {
          setIsSending(false)
          return
        }
      }

      const questionId = `question-${Date.now()}`
      const effectiveRetriever = retrieverOverride || retriever

      // Für normale Fragen: Füge Frage als Message hinzu
      if (!isTOC) {
        const questionMessage: ChatMessage = {
          id: questionId,
          type: 'question',
          content: questionText,
          createdAt: new Date().toISOString(),
          character,
          answerLength,
          retriever: effectiveRetriever === 'auto' ? undefined : effectiveRetriever,
          targetLanguage,
          socialContext,
        }
        setMessages((prev) => [...prev, questionMessage])
        setOpenConversations(new Set())
      }

      try {
        // Query-Parameter bauen
        const params = new URLSearchParams()
        Object.entries(galleryFilters || {}).forEach(([k, arr]) => {
          if (Array.isArray(arr)) {
            for (const v of arr) {
              params.append(k, String(v))
            }
          }
        })

        // Bei 'auto' keinen expliziten retriever-Parameter setzen
        if (effectiveRetriever !== 'auto') {
          params.set('retriever', effectiveRetriever)
        }

        params.set('targetLanguage', targetLanguage)
        params.set('character', character)
        params.set('socialContext', socialContext)
        params.set('genderInclusive', String(genderInclusive))

        // Bereite Chatverlauf vor: Nur vollständige Frage-Antwort-Paare
        const chatHistory: Array<{ question: string; answer: string }> = []
        const recentMessages = messages.slice(-10) // Letzte 10 Messages (max. 5 Paare)
        for (let i = 0; i < recentMessages.length - 1; i++) {
          const msg = recentMessages[i]
          const nextMsg = recentMessages[i + 1]
          if (msg.type === 'question' && nextMsg.type === 'answer') {
            chatHistory.push({
              question: msg.content,
              answer: nextMsg.content,
            })
          }
        }
        const limitedChatHistory = chatHistory.slice(-5)

        // Stream-Endpoint aufrufen
        const streamUrl = `/api/chat/${encodeURIComponent(libraryId)}/stream${params.toString() ? `?${params.toString()}` : ''}`

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...sessionHeaders,
        }

        const res = await fetch(streamUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            asTOC: asTOC || undefined, // Sende asTOC Flag, wenn gesetzt
            message: questionText,
            answerLength,
            chatHistory: limitedChatHistory.length > 0 ? limitedChatHistory : undefined,
            chatId: activeChatId || undefined,
          }),
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        // SSE Stream verarbeiten
        const reader = res.body?.getReader()
        if (!reader) {
          throw new Error('Stream nicht verfügbar')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const [steps, newBuffer] = parseSSELines(chunk, buffer)
          buffer = newBuffer

          for (const step of steps) {
            setProcessingSteps((prev) => [...prev, step])

            // Handle complete step
            if (step.type === 'complete') {
              // Check if this is a clarification response
              const clarificationStep = step as ChatProcessingStep & {
                clarification?: {
                  explanation: string
                  suggestedQuestions: { chunk?: string; summary?: string }
                }
              }
              if (clarificationStep.clarification) {
                const clarificationMessage: ChatMessage = {
                  id: `clarification-${Date.now()}`,
                  type: 'answer',
                  content: step.answer,
                  suggestedQuestions: step.suggestedQuestions,
                  createdAt: new Date().toISOString(),
                }
                setMessages((prev) => [...prev, clarificationMessage])
                setProcessingSteps([])
                setIsSending(false)
                return
              }

              if (typeof step.chatId === 'string' && !activeChatId) {
                setActiveChatId(step.chatId)
              }

              const finalQueryId =
                typeof step.queryId === 'string' ? step.queryId : `temp-${Date.now()}`

              // Type Guard für complete-Step mit storyTopicsData
              const completeStep = step as ChatProcessingStep & {
                storyTopicsData?: StoryTopicsData
              }

              // Extrahiere Referenzen und suggestedQuestions
              const refs: ChatResponse['references'] = Array.isArray(step.references)
                ? step.references.filter(
                    (r): r is ChatResponse['references'][number] =>
                      typeof r === 'object' &&
                      r !== null &&
                      'number' in r &&
                      'fileId' in r &&
                      'description' in r
                  )
                : []
              const suggestedQuestions = Array.isArray(step.suggestedQuestions)
                ? step.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
                : []

              // Für TOC-Queries: Rufe Callback auf
              if (isTOC) {
                onTOCComplete?.({
                  storyTopicsData: completeStep.storyTopicsData,
                  answer: step.answer,
                  references: refs,
                  suggestedQuestions,
                  queryId: finalQueryId,
                })
                setProcessingSteps([])
                setIsSending(false)
                return
              }

              // Für normale Fragen: Erstelle Antwort-Message
              const answerMessage: ChatMessage = {
                id: `${finalQueryId}-answer`,
                type: 'answer',
                content: step.answer,
                references: refs,
                suggestedQuestions,
                queryId: finalQueryId,
                createdAt: new Date().toISOString(),
                answerLength,
                retriever: effectiveRetriever === 'auto' ? undefined : effectiveRetriever,
                targetLanguage,
                character,
                socialContext,
              }

              if (answerMessage.content) {
                if (answerMessage.references) {
                  setChatReferences(answerMessage.references)
                }

                setMessages((prev) => [...prev, answerMessage])

                // Aktualisiere die vorhandene Frage mit queryId
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === questionId ? { ...msg, queryId: finalQueryId } : msg
                  )
                )

                // Schließe alle vorherigen Accordions und öffne nur das neue
                const newConversationId = finalQueryId
                setOpenConversations(new Set([newConversationId]))

                // Scroll zum neuen Accordion nach kurzer Verzögerung
                setTimeout(() => {
                  const element = document.querySelector(`[data-conversation-id="${newConversationId}"]`)
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  }
                }, 500)
              }

              setProcessingSteps([])
              setIsSending(false)
              return
            }

            // Handle error step
            if (step.type === 'error') {
              const formattedError = formatChatError(step.error || 'Unbekannter Fehler')
              throw new Error(formattedError)
            }
          }
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unbekannter Fehler'
        const formattedError = formatChatError(errorMessage)
        onError?.(formattedError)
        // Entferne die Frage nur, wenn es keine TOC-Query war
        if (!isTOC) {
          setMessages((prev) => prev.filter((m) => m.id !== questionId))
        }
      } finally {
        setIsSending(false)
      }
    },
    [
      cfg,
      isSending,
      messages,
      retriever,
      answerLength,
      targetLanguage,
      character,
      socialContext,
      genderInclusive,
      galleryFilters,
      activeChatId,
      sessionHeaders,
      setMessages,
      setActiveChatId,
      setOpenConversations,
      setChatReferences,
      onTOCComplete,
      onError,
      libraryId,
    ]
  )

  return {
    isSending,
    processingSteps,
    sendQuestion,
    setProcessingSteps,
  }
}

