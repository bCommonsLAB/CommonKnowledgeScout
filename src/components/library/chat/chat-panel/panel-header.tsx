'use client'

/**
 * Kopf des Chat-Panels (D6): Konfig-Leiste mit Popover — nur im Chat-Reiter,
 * eingebettet (Story-Modus) steuert der Story-Kopf die Perspektive.
 */

import { ChatConfigBar } from '../chat-config-bar'
import { ChatConfigPopover } from '../chat-config-popover'
import type { AccessPerspective, AnswerLength, Character, Retriever, SocialContext, TargetLanguage } from '@/lib/chat/constants'
import type { UserPreferences } from './hooks/use-chat-actions'

export interface ChatPanelHeaderProps {
  libraryId: string
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
  targetLanguage: TargetLanguage
  setTargetLanguage: (v: TargetLanguage) => void
  character: Character[]
  setCharacter: (v: Character[]) => void
  accessPerspective: AccessPerspective[]
  setAccessPerspective: (v: AccessPerspective[]) => void
  socialContext: SocialContext
  setSocialContext: (v: SocialContext) => void
  popoverOpen: boolean
  onPopoverOpenChange: (open: boolean) => void
  answerLength: AnswerLength
  setAnswerLength: (v: AnswerLength) => void
  retriever: Retriever
  setRetriever: (v: Retriever) => void
  genderInclusive: boolean
  setGenderInclusive: (v: boolean) => void
  onGenerateTOC: () => Promise<void>
  onSavePreferences: (settings: UserPreferences) => Promise<void>
}

export function ChatPanelHeader(p: ChatPanelHeaderProps) {
  return (
    <ChatConfigBar
      targetLanguage={p.targetLanguage}
      setTargetLanguage={p.setTargetLanguage}
      character={p.character}
      setCharacter={p.setCharacter}
      accessPerspective={p.accessPerspective}
      setAccessPerspective={p.setAccessPerspective}
      socialContext={p.socialContext}
      setSocialContext={p.setSocialContext}
      libraryId={p.libraryId}
      activeChatId={p.activeChatId}
      setActiveChatId={p.setActiveChatId}
      isEmbedded={false}
    >
      <ChatConfigPopover
        open={p.popoverOpen}
        onOpenChange={p.onPopoverOpenChange}
        answerLength={p.answerLength}
        setAnswerLength={p.setAnswerLength}
        retriever={p.retriever}
        setRetriever={p.setRetriever}
        genderInclusive={p.genderInclusive}
        setGenderInclusive={p.setGenderInclusive}
        targetLanguage={p.targetLanguage}
        character={p.character}
        socialContext={p.socialContext}
        onGenerateTOC={p.onGenerateTOC}
        onSavePreferences={p.onSavePreferences}
      />
    </ChatConfigBar>
  )
}
