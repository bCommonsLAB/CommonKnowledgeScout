/**
 * Aktionen des Chat-Panels (D6, aus chat-panel.tsx ausgegliedert, Verhalten
 * 1:1): Frage loeschen, Frage neu stellen, Praeferenzen in der Library
 * sichern, senden.
 */

import type { Dispatch, SetStateAction } from 'react'
import { TOC_QUESTION, type AnswerLength, type Character, type Retriever, type SocialContext, type TargetLanguage } from '@/lib/chat/constants'
import type { ChatMessage } from '../../utils/chat-utils'
import type { UseChatStreamResult } from '../../hooks/use-chat-stream/types'

export interface UseChatActionsParams {
  libraryId: string
  cfg: unknown
  sessionHeaders: Record<string, string>
  input: string
  setInput: (v: string) => void
  messages: ChatMessage[]
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  checkTOCCache: () => Promise<void>
  sendQuestion: UseChatStreamResult['sendQuestion']
  setCharacter: (v: Character[]) => void
  setAnswerLength: (v: AnswerLength) => void
  setRetriever: (v: Retriever) => void
  setTargetLanguage: (v: TargetLanguage) => void
  setSocialContext: (v: SocialContext) => void
  setGenderInclusive: (v: boolean) => void
}

export interface ReloadConfig {
  character?: Character[]
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  socialContext?: SocialContext
}

export interface UserPreferences {
  targetLanguage: TargetLanguage
  character: Character[]
  socialContext: SocialContext
  genderInclusive: boolean
}

export function useChatActions(p: UseChatActionsParams) {
  const { libraryId, cfg, sessionHeaders, input, setInput, messages, setMessages, checkTOCCache, sendQuestion } = p

  async function handleDeleteQuery(queryId: string): Promise<void> {
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
        method: 'DELETE',
        headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
      })
      if (!res.ok) {
        let errorMessage = 'Fehler beim Löschen der Query'
        try {
          const contentType = res.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json()
            if (typeof errorData?.error === 'string') errorMessage = errorData.error
          } else {
            errorMessage = res.statusText || `HTTP ${res.status}`
          }
        } catch (parseError) {
          console.warn('[ChatPanel] Fehler beim Parsen der Error-Response:', parseError)
          errorMessage = res.statusText || `HTTP ${res.status}`
        }
        console.error('[ChatPanel] Fehler beim Löschen:', { status: res.status, statusText: res.statusText, errorMessage })
        throw new Error(errorMessage)
      }
      const wasTOCQuery = messages.some((msg) => msg.queryId === queryId && msg.type === 'question' && msg.content.trim() === TOC_QUESTION.trim())
      setMessages((prev) => prev.filter((msg) => msg.queryId !== queryId))
      if (wasTOCQuery) setTimeout(() => void checkTOCCache(), 500)
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Löschen der Query:', error)
      if (error instanceof Error) throw error
      throw new Error('Unbekannter Fehler beim Löschen')
    }
  }

  async function onSend(asTOC?: boolean) {
    if (!cfg) return
    if (!input.trim()) return
    await sendQuestion(input.trim(), undefined, false, asTOC)
    setInput('')
  }

  async function handleReloadQuestion(question: string, config: ReloadConfig): Promise<void> {
    if (config.character) p.setCharacter(config.character)
    if (config.answerLength) p.setAnswerLength(config.answerLength)
    if (config.retriever) p.setRetriever(config.retriever)
    if (config.targetLanguage) p.setTargetLanguage(config.targetLanguage)
    if (config.socialContext) p.setSocialContext(config.socialContext)
    setInput(question)
    await new Promise((resolve) => setTimeout(resolve, 150))
    setTimeout(() => {
      if (input.trim()) void onSend()
    }, 100)
  }

  function uebernehmen(settings: UserPreferences) {
    p.setTargetLanguage(settings.targetLanguage)
    p.setCharacter(settings.character)
    p.setSocialContext(settings.socialContext)
    p.setGenderInclusive(settings.genderInclusive)
  }

  async function saveUserPreferences(settings: UserPreferences): Promise<void> {
    try {
      const response = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: libraryId, config: { chat: { userPreferences: settings } } }),
      }).catch(() => undefined)
      // In jedem Ausgang gelten die Werte lokal; nur ein echter Serverfehler wird gemeldet.
      uebernehmen(settings)
      if (!response || !response.ok) {
        if (!response || response.status === 401 || response.status === 403) return
        throw new Error('Fehler beim Speichern der Präferenzen')
      }
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Speichern der Präferenzen:', error)
      uebernehmen(settings)
    }
  }

  return { handleDeleteQuery, handleReloadQuestion, saveUserPreferences, onSend }
}
