/**
 * Perspektiven-Zustand des Chat-Panels (D6, aus chat-panel.tsx ausgegliedert).
 *
 * Eingebettet (Story-Modus) kommen Sprache, Charakter, Zugangsperspektive,
 * sozialer Kontext und Modell aus dem Story-Context; im Chat-Reiter aus
 * lokalem Zustand mit localStorage-Startwerten. Die Setter zeigen auf
 * dieselbe Quelle. `lokal` sind die lokalen Werte, die das Konfig-Popover
 * beim Schliessen fuer anonyme Betrachter sichert.
 *
 * Verhalten 1:1 portiert; die Debug-Logs der Quelle sind entfallen.
 */

import { useState } from 'react'
import type {
  AccessPerspective,
  Character,
  LlmModelId,
  SocialContext,
  TargetLanguage,
} from '@/lib/chat/constants'
import { useStoryContext } from '@/hooks/use-story-context'
import {
  getInitialAccessPerspective,
  getInitialCharacter,
  getInitialGenderInclusive,
  getInitialLlmModel,
  getInitialSocialContext,
  getInitialTargetLanguage,
} from '../../utils/chat-storage'

export interface ChatPerspectiveState {
  targetLanguage: TargetLanguage
  character: Character[]
  accessPerspective: AccessPerspective[]
  socialContext: SocialContext
  /** Leer, solange kein Modell bestimmt ist (eingebettet: Story-Context). */
  llmModel: LlmModelId | ''
  genderInclusive: boolean
  setGenderInclusive: (v: boolean) => void
  setTargetLanguage: (v: TargetLanguage) => void
  setCharacter: (v: Character[]) => void
  setAccessPerspective: (v: AccessPerspective[]) => void
  setSocialContext: (v: SocialContext) => void
  /** Die lokalen Werte (Chat-Reiter) — fuer das Sichern anonymer Praeferenzen. */
  lokal: {
    targetLanguage: TargetLanguage
    character: Character[]
    accessPerspective: AccessPerspective[]
    socialContext: SocialContext
  }
}

export function useChatPerspectiveState(isEmbedded: boolean): ChatPerspectiveState {
  const storyContext = useStoryContext()
  const [targetLanguageState, setTargetLanguageState] = useState<TargetLanguage>(getInitialTargetLanguage())
  const [characterState, setCharacterState] = useState<Character[]>(getInitialCharacter())
  const [accessPerspectiveState, setAccessPerspectiveState] = useState<AccessPerspective[]>(getInitialAccessPerspective())
  const [socialContextState, setSocialContextState] = useState<SocialContext>(getInitialSocialContext())
  const [genderInclusive, setGenderInclusive] = useState<boolean>(getInitialGenderInclusive())
  const [llmModelState] = useState<LlmModelId>(getInitialLlmModel())

  return {
    targetLanguage: isEmbedded ? storyContext.targetLanguage : targetLanguageState,
    character: isEmbedded ? storyContext.character : characterState,
    accessPerspective: isEmbedded ? storyContext.accessPerspective : accessPerspectiveState,
    socialContext: isEmbedded ? storyContext.socialContext : socialContextState,
    llmModel: (isEmbedded ? storyContext.llmModel : llmModelState) || '',
    genderInclusive,
    setGenderInclusive,
    setTargetLanguage: isEmbedded ? storyContext.setTargetLanguage : setTargetLanguageState,
    setCharacter: isEmbedded ? storyContext.setCharacter : setCharacterState,
    setAccessPerspective: isEmbedded ? storyContext.setAccessPerspective : setAccessPerspectiveState,
    setSocialContext: isEmbedded ? storyContext.setSocialContext : setSocialContextState,
    lokal: {
      targetLanguage: targetLanguageState,
      character: characterState,
      accessPerspective: accessPerspectiveState,
      socialContext: socialContextState,
    },
  }
}
