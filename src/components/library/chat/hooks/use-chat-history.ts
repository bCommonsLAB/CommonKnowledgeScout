/**
 * Hook für Chat-Historie
 * 
 * Lädt historische Queries für einen Chat und konvertiert sie zu ChatMessages.
 * Filtert TOC-Queries heraus, da diese separat angezeigt werden.
 *
 * D6: Eine Anfrage je Sitzung (Liste mit allen Feldern, bis 100 Fragen)
 * statt eine je Frage; die Umsetzung Liste → Nachrichten liegt als reine
 * Funktion in `utils/verlauf-utils.ts`.
 */

import { useEffect, useState, useRef } from 'react'
import type { ChatMessage } from '../utils/chat-utils'
import { useClerkSessionHeaders } from '@/hooks/use-clerk-session-headers'
import { VERLAUF_LIMIT, verlaufZuNachrichten, type VerlaufEintrag } from '../utils/verlauf-utils'

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
  const sessionHeaders = useClerkSessionHeaders()

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
          `/api/chat/${encodeURIComponent(libraryId)}/queries?limit=${VERLAUF_LIMIT}&chatId=${encodeURIComponent(activeChatId)}`,
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
        let data: { items?: VerlaufEintrag[]; error?: unknown }
        try {
          data = (await res.json()) as typeof data
        } catch (jsonError) {
          console.error('[useChatHistory] JSON-Parsing-Fehler:', jsonError)
          throw new Error('Fehler beim Parsen der API-Antwort als JSON')
        }

        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Historie')
        }

        if (!cancelled && Array.isArray(data.items)) {
          // D6: Nachrichten direkt aus der Liste — keine Anfrage je Frage mehr.
          const historyMessages = verlaufZuNachrichten(data.items)

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

