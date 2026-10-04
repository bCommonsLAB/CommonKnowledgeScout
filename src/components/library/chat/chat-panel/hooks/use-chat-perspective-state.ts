/**
 * Perspektiven-Zustand des Chat-Reiters (D6 ausgegliedert; D6c ohne den
 * Story-Zweig): Sprache, Charakter, Zugangsperspektive, sozialer Kontext,
 * gendergerechte Sprache und Modell aus lokalem Zustand mit
 * localStorage-Startwerten. Die Story-Mitte bezieht ihre Perspektive seit
 * D6c aus dem Story-Context (`story/story-root-mount.tsx`).
 */

import { useState } from 'react'
import type { AccessPerspective, Character, LlmModelId, SocialContext, TargetLanguage } from '@/lib/chat/constants'
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
  /** Leer, solange kein Modell bestimmt ist. */
  llmModel: LlmModelId | ''
  genderInclusive: boolean
  setGenderInclusive: (v: boolean) => void
  setTargetLanguage: (v: TargetLanguage) => void
  setCharacter: (v: Character[]) => void
  setAccessPerspective: (v: AccessPerspective[]) => void
  setSocialContext: (v: SocialContext) => void
}

export function useChatPerspectiveState(): ChatPerspectiveState {
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(getInitialTargetLanguage())
  const [character, setCharacter] = useState<Character[]>(getInitialCharacter())
  const [accessPerspective, setAccessPerspective] = useState<AccessPerspective[]>(getInitialAccessPerspective())
  const [socialContext, setSocialContext] = useState<SocialContext>(getInitialSocialContext())
  const [genderInclusive, setGenderInclusive] = useState<boolean>(getInitialGenderInclusive())
  const [llmModel] = useState<LlmModelId>(getInitialLlmModel())

  return {
    targetLanguage,
    character,
    accessPerspective,
    socialContext,
    llmModel: llmModel || '',
    genderInclusive,
    setGenderInclusive,
    setTargetLanguage,
    setCharacter,
    setAccessPerspective,
    setSocialContext,
  }
}
