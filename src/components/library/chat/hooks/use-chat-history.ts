/**
 * Hook für Chat-Historie
 * 
 * Lädt historische Queries für einen Chat und konvertiert sie zu ChatMessages.
 * Filtert TOC-Queries heraus, da diese separat angezeigt werden.
 */

import { useEffect, useState, useRef } from 'react'
import type { ChatMessage } from '../utils/chat-utils'
import { createMessagesFromQueryLog } from '../utils/chat-utils'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import type { ChatResponse } from '@/types/chat-response'

interface UseChatHistoryParams {
  libraryId: string
  activeChatId: string | null
}

interface UseChatHistoryResult {
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  prevMessagesLengthRef: React.MutableRefObject<number>
}

/**
 * Hook für Chat-Historie
 * 
 * Lädt historische Queries für einen aktiven Chat und konvertiert sie zu Messages.
 * 
 * @param params - Parameter für Historie-Laden
 * @returns Messages, Setter und Ref für vorherige Länge
 */
export function useChatHistory(params: UseChatHistoryParams): UseChatHistoryResult {
  const { libraryId, activeChatId } = params
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const prevMessagesLengthRef = useRef(0)
  const sessionHeaders = useSessionHeaders()

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      if (!activeChatId) {
        // Wenn kein aktiver Chat, behalte vorhandene Messages (z.B. neu hinzugefügte TOC-Queries)
        if (!cancelled) {
          setMessages((prev) => (prev.length > 0 ? prev : []))
        }
        return
      }

      try {
        const res = await fetch(
          `/api/chat/${encodeURIComponent(libraryId)}/queries?limit=20&chatId=${encodeURIComponent(activeChatId)}`,
          {
            cache: 'no-store',
            headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
          }
        )
        const data = (await res.json()) as {
          items?: Array<{
            queryId: string
            createdAt: string
            question: string
            mode: string
            status: string
          }>
          error?: unknown
        }
        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Historie'
          )
        }

        if (!cancelled && Array.isArray(data.items)) {
          // Lade für jede historische Frage die vollständige Antwort
          // Filtere TOC-Queries heraus - diese werden separat unter der Kontextbar angezeigt
          const historyMessages: ChatMessage[] = []

          for (const item of data.items) {
            try {
              const queryRes = await fetch(
                `/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(item.queryId)}`,
                {
                  cache: 'no-store',
                  headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
                }
              )
              const queryData = (await queryRes.json()) as {
                answer?: string
                queryType?: string
                references?: unknown[]
                suggestedQuestions?: unknown[]
                answerLength?: string
                retriever?: string
                targetLanguage?: string
                character?: string
                socialContext?: string
              }

              if (queryRes.ok && typeof queryData?.answer === 'string') {
                // Überspringe TOC-Queries - diese werden separat angezeigt
                if (queryData.queryType === 'toc') {
                  continue
                }

                // Filtere und typisiere Referenzen korrekt
                const references: ChatResponse['references'] = Array.isArray(queryData.references)
                  ? queryData.references.filter(
                      (r): r is ChatResponse['references'][number] =>
                        typeof r === 'object' &&
                        r !== null &&
                        'number' in r &&
                        'fileId' in r &&
                        'description' in r
                    )
                  : []
                const suggestedQuestions: string[] = Array.isArray(queryData.suggestedQuestions)
                  ? queryData.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
                  : []

                // Verwende gemeinsame Funktion zur Erstellung der Messages
                const msgs = createMessagesFromQueryLog({
                  queryId: item.queryId,
                  question: item.question,
                  answer: queryData.answer,
                  references: references.length > 0 ? references : undefined,
                  suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
                  createdAt: item.createdAt,
                  answerLength: queryData.answerLength as 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt' | undefined,
                  retriever: queryData.retriever as 'chunk' | 'doc' | 'summary' | 'auto' | undefined,
                  targetLanguage: queryData.targetLanguage as 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar' | undefined,
                  character: queryData.character,
                  socialContext: queryData.socialContext as 'scientific' | 'general' | 'youth' | 'senior' | 'professional' | 'children' | 'easy_language' | undefined,
                })
                historyMessages.push(...msgs)
              }
            } catch {
              // Ignoriere Fehler beim Laden einzelner Queries
            }
          }

          // Sortiere nach Datum (neueste zuerst) und kehre um für chronologische Reihenfolge
          historyMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )

          if (!cancelled) {
            // Merge mit vorhandenen Messages: Behalte neu hinzugefügte Messages (z.B. TOC-Queries)
            // die noch nicht in der Historie sind
            setMessages((prev) => {
              // Sammle alle queryIds aus der Historie
              const historyQueryIds = new Set(
                historyMessages.map((m) => m.queryId).filter((id): id is string => !!id)
              )

              // Behalte Messages, die nicht in der Historie sind (neu hinzugefügte)
              const newMessages = prev.filter(
                (m) => !m.queryId || !historyQueryIds.has(m.queryId)
              )

              // Kombiniere neue Messages mit Historie und sortiere
              const merged = [...newMessages, ...historyMessages]
              merged.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              )

              return merged
            })
            // Setze prevMessagesLengthRef, damit beim ersten Laden nicht gescrollt wird
            prevMessagesLengthRef.current = historyMessages.length
          }
        }
      } catch {
        // Bei Fehlern behalte vorhandene Messages, setze nur leer wenn keine vorhanden sind
        if (!cancelled) {
          setMessages((prev) => (prev.length > 0 ? prev : []))
        }
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [libraryId, activeChatId, sessionHeaders])

  return { messages, setMessages, prevMessagesLengthRef }
}

