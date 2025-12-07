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
import type { TargetLanguage } from '@/lib/chat/constants'

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
        // Wenn kein aktiver Chat, behalte vorhandene Messages (z.B. neu hinzugefügte TOC-Queries oder neu gestellte Fragen).
        // WICHTIG: Messages immer behalten, auch wenn activeChatId null ist, damit sie bei Perspektiven-/Filter-Änderungen erhalten bleiben.
        if (!cancelled) setMessages((prev) => prev)
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
        
        // 404 bedeutet: Keine Historie vorhanden (normaler Zustand, kein Fehler)
        if (res.status === 404) {
          if (!cancelled) setMessages((prev) => prev)
          return
        }
        
        // Prüfe Content-Type bevor JSON-Parsing
        const contentType = res.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          // Klone Response, damit wir sie später noch lesen können
          const clonedRes = res.clone()
          const text = await clonedRes.text()
          console.error('[useChatHistory] API gibt kein JSON zurück:', {
            status: res.status,
            statusText: res.statusText,
            contentType,
            responsePreview: text.substring(0, 200),
            activeChatId,
            libraryId,
          })
          throw new Error(`API-Fehler: Erwartete JSON, bekam ${contentType || 'unbekannt'}`)
        }

        // Parse JSON nur wenn Content-Type korrekt ist
        let data: {
          items?: Array<{
            queryId: string
            createdAt: string
            question: string
            mode: string
            status: string
          }>
          error?: unknown
        }
        
        try {
          data = (await res.json()) as typeof data
        } catch (jsonError) {
          console.error('[useChatHistory] JSON-Parsing-Fehler:', jsonError)
          throw new Error('Fehler beim Parsen der API-Antwort als JSON')
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
                character?: import('@/lib/chat/constants').Character[] // Array (kann leer sein)
                accessPerspective?: import('@/lib/chat/constants').AccessPerspective[]
                socialContext?: string
                genderInclusive?: boolean
                facetsSelected?: Record<string, unknown>
                cacheParams?: {
                  queryType?: string
                  answerLength?: 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'
                  retriever?: 'chunk' | 'doc' | 'summary' | 'auto'
                  targetLanguage?: TargetLanguage
                  character?: import('@/lib/chat/constants').Character[]
                  accessPerspective?: import('@/lib/chat/constants').AccessPerspective[]
                  socialContext?: 'scientific' | 'general' | 'youth' | 'senior' | 'professional' | 'children' | 'easy_language'
                  genderInclusive?: boolean
                  facetsSelected?: Record<string, unknown>
                }
              }

              if (queryRes.ok && typeof queryData?.answer === 'string') {
                // Überspringe TOC-Queries - diese werden separat angezeigt
                // Extrahiere queryType aus cacheParams, falls vorhanden (neue Einträge), sonst Root-Feld (alte Einträge)
                const queryType = queryData.cacheParams?.queryType ?? queryData.queryType
                if (queryType === 'toc') {
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
                // Extrahiere Cache-Felder aus cacheParams, falls vorhanden (neue Einträge), sonst Root-Felder (alte Einträge)
                const msgs = createMessagesFromQueryLog({
                  queryId: item.queryId,
                  question: item.question,
                  answer: queryData.answer,
                  references: references.length > 0 ? references : undefined,
                  suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
                  createdAt: item.createdAt,
                  answerLength: (queryData.cacheParams?.answerLength ?? queryData.answerLength) as 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt' | undefined,
                  retriever: (queryData.cacheParams?.retriever ?? queryData.retriever) as 'chunk' | 'doc' | 'summary' | 'auto' | undefined,
                  targetLanguage: (queryData.cacheParams?.targetLanguage ?? queryData.targetLanguage) as TargetLanguage | undefined,
                  character: queryData.cacheParams?.character ?? queryData.character,
                  accessPerspective: queryData.cacheParams?.accessPerspective ?? queryData.accessPerspective,
                  socialContext: (queryData.cacheParams?.socialContext ?? queryData.socialContext) as 'scientific' | 'general' | 'youth' | 'senior' | 'professional' | 'children' | 'easy_language' | undefined,
                  genderInclusive: queryData.cacheParams?.genderInclusive ?? queryData.genderInclusive,
                  facetsSelected: (queryData.cacheParams?.facetsSelected ?? queryData.facetsSelected) as import('@/atoms/gallery-filters').GalleryFilters | undefined,
                  cacheParams: queryData.cacheParams, // Übergebe cacheParams für Extraktion in createMessagesFromQueryLog
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
              // Wenn Historie leer ist aber vorhandene Messages existieren, behalte diese
              // (verhindert Überschreibung bei Timing-Problemen oder wenn Historie noch nicht geladen ist)
              if (historyMessages.length === 0 && prev.length > 0) {
                return prev
              }

              // Sammle alle queryIds aus der Historie
              const historyQueryIds = new Set(
                historyMessages.map((m) => m.queryId).filter((id): id is string => !!id)
              )

              // Behalte Messages, die nicht in der Historie sind (neu hinzugefügte)
              // WICHTIG: Behalte auch Messages ohne queryId, die nicht in Historie sind
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
      } catch (error) {
        // Bei Fehlern behalte IMMER vorhandene Messages.
        // WICHTIG: Auch wenn keine Messages vorhanden sind, nicht löschen, da sie möglicherweise gerade geladen werden.
        console.error('[useChatHistory] Fehler beim Laden der Historie:', error)
        if (!cancelled) setMessages((prev) => prev)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [libraryId, activeChatId, sessionHeaders])

  return { messages, setMessages, prevMessagesLengthRef }
}

