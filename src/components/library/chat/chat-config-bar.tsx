'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChatSelector } from './chat-selector'
import type { Character, TargetLanguage, SocialContext, AccessPerspective } from '@/lib/chat/constants'
import {
  TARGET_LANGUAGE_VALUES,
  CHARACTER_VALUES,
  ACCESS_PERSPECTIVE_VALUES,
  SOCIAL_CONTEXT_VALUES,
} from '@/lib/chat/constants'
import { useStoryContext } from '@/hooks/use-story-context'

interface ChatConfigBarProps {
  targetLanguage: TargetLanguage
  setTargetLanguage: (value: TargetLanguage) => void
  character: Character[] // Array (kann leer sein)
  setCharacter: (value: Character[]) => void
  accessPerspective: AccessPerspective[] // Array (kann leer sein)
  setAccessPerspective: (value: AccessPerspective[]) => void
  socialContext: SocialContext
  setSocialContext: (value: SocialContext) => void
  libraryId: string
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
  isEmbedded?: boolean
  children?: React.ReactNode // Für Config-Popover
}

/**
 * Konfigurationsleiste oben im ChatPanel
 * 
 * Enthält:
 * - Dropdowns für Sprache, Charakter, Zugangsperspektive, sozialer Kontext
 * - Config-Popover-Trigger
 * - Chat-Selector (nur im non-embedded Modus)
 */
export function ChatConfigBar({
  targetLanguage,
  setTargetLanguage,
  character,
  setCharacter,
  accessPerspective,
  setAccessPerspective,
  socialContext,
  setSocialContext,
  libraryId,
  activeChatId,
  setActiveChatId,
  isEmbedded = false,
  children,
}: ChatConfigBarProps) {
  const { targetLanguageLabels, characterLabels, accessPerspectiveLabels, socialContextLabels } = useStoryContext()
  
  // Verwende ersten Wert für Select (kann undefined sein)
  const characterValue = character && character.length > 0 ? character[0] : undefined
  const accessPerspectiveValue = accessPerspective && accessPerspective.length > 0 ? accessPerspective[0] : undefined
  
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
        <Select value={characterValue || ''} onValueChange={(v) => setCharacter(v ? [v as Character] : [])}>
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
        
        {/* Zugangsperspektive */}
        <Select value={accessPerspectiveValue || ''} onValueChange={(v) => setAccessPerspective(v ? [v as AccessPerspective] : [])}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCESS_PERSPECTIVE_VALUES.map((ap) => (
              <SelectItem key={ap} value={ap}>
                {accessPerspectiveLabels[ap]}
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
              // Messages werden durch use-chat-history.ts verwaltet.
            }}
            onCreateNewChat={() => {
              // Neue Chats werden durch die Chat-API und use-chat-history.ts verwaltet.
            }}
          />
        </div>
      </div>
      
      {/* Trennlinie unter der Kontextbar */}
      <div className="border-b mb-4"></div>
    </>
  )
}

