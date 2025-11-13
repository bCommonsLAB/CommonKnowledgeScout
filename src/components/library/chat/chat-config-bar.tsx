'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChatSelector } from './chat-selector'
import type { Character, TargetLanguage, SocialContext } from '@/lib/chat/constants'
import type { ChatMessage } from './utils/chat-utils'
import {
  TARGET_LANGUAGE_VALUES,
  CHARACTER_VALUES,
  SOCIAL_CONTEXT_VALUES,
} from '@/lib/chat/constants'
import { useStoryContext } from '@/hooks/use-story-context'

interface ChatConfigBarProps {
  targetLanguage: TargetLanguage
  setTargetLanguage: (value: TargetLanguage) => void
  character: Character
  setCharacter: (value: Character) => void
  socialContext: SocialContext
  setSocialContext: (value: SocialContext) => void
  libraryId: string
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  isEmbedded?: boolean
  children?: React.ReactNode // Für Config-Popover
}

/**
 * Konfigurationsleiste oben im ChatPanel
 * 
 * Enthält:
 * - Dropdowns für Sprache, Charakter, sozialer Kontext
 * - Config-Popover-Trigger
 * - Chat-Selector (nur im non-embedded Modus)
 */
export function ChatConfigBar({
  targetLanguage,
  setTargetLanguage,
  character,
  setCharacter,
  socialContext,
  setSocialContext,
  libraryId,
  activeChatId,
  setActiveChatId,
  setMessages,
  isEmbedded = false,
  children,
}: ChatConfigBarProps) {
  const { targetLanguageLabels, characterLabels, socialContextLabels } = useStoryContext()
  
  if (isEmbedded) {
    // Im embedded Modus wird die ConfigBar nicht angezeigt
    return null
  }

  return (
    <>
      <div className="flex items-center gap-2 pb-2 flex-shrink-0">
        {/* Zielsprache */}
        <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as TargetLanguage)}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_LANGUAGE_VALUES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {targetLanguageLabels[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Perspektive (Charakter) */}
        <Select value={character} onValueChange={(v) => setCharacter(v as Character)}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHARACTER_VALUES.map((char) => (
              <SelectItem key={char} value={char}>
                {characterLabels[char]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Sozialer Kontext */}
        <Select value={socialContext} onValueChange={(v) => setSocialContext(v as SocialContext)}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOCIAL_CONTEXT_VALUES.map((ctx) => (
              <SelectItem key={ctx} value={ctx}>
                {socialContextLabels[ctx]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Config-Popover wird als children übergeben */}
        {children}
        
        {/* Chat-Selector rechts */}
        <div className="ml-auto">
          <ChatSelector
            libraryId={libraryId}
            activeChatId={activeChatId}
            onChatChange={(chatId) => {
              setActiveChatId(chatId)
              if (chatId) {
                // Messages werden durch loadHistory useEffect geladen
              } else {
                setMessages([])
              }
            }}
            onCreateNewChat={() => {
              // Leere Messages, wenn neuer Chat erstellt wird
              setMessages([])
            }}
          />
        </div>
      </div>
      
      {/* Trennlinie unter der Kontextbar */}
      <div className="border-b mb-4"></div>
    </>
  )
}

