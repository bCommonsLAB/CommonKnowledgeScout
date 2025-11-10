/**
 * Hook für Chat-Konfiguration mit Prioritätenlogik
 * 
 * Verwaltet die Priorität: localStorage (anonym) > userPreferences > Config-Defaults
 * Wird nur im Chat verwendet.
 */

import { useEffect, useRef } from 'react'
import type { TargetLanguage, Character, SocialContext } from '@/lib/chat/constants'
import {
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
} from '@/lib/chat/constants'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useAnonymousPreferences } from '@/hooks/use-anonymous-preferences'
import {
  getInitialTargetLanguage,
  getInitialCharacter,
  getInitialSocialContext,
} from '../utils/chat-storage'

interface ChatConfigData {
  targetLanguage?: TargetLanguage
  character?: Character
  socialContext?: SocialContext
  genderInclusive?: boolean
  userPreferences?: {
    targetLanguage?: TargetLanguage
    character?: Character
    socialContext?: SocialContext
    genderInclusive?: boolean
  }
}

interface UseChatConfigParams {
  libraryId: string
  isEmbedded: boolean
  isAnonymous: boolean
  storyContext?: {
    targetLanguage: TargetLanguage
    character: Character
    socialContext: SocialContext
  }
  initialTargetLanguage: TargetLanguage
  initialCharacter: Character
  initialSocialContext: SocialContext
  initialGenderInclusive: boolean
  setTargetLanguage: (value: TargetLanguage) => void
  setCharacter: (value: Character) => void
  setSocialContext: (value: SocialContext) => void
  setGenderInclusive: (value: boolean) => void
}

/**
 * Hook für Chat-Konfiguration mit Prioritätenlogik
 * 
 * Priorität: localStorage (anonym) > userPreferences > Config-Defaults
 * 
 * @param params - Konfigurationsparameter
 */
export function useChatConfig(params: UseChatConfigParams) {
  const {
    libraryId,
    isEmbedded,
    isAnonymous,
    setTargetLanguage,
    setCharacter,
    setSocialContext,
    setGenderInclusive,
  } = params

  const { cfg } = useLibraryConfig(libraryId)
  const { hasValues: hasLocalStorageValues } =
    useAnonymousPreferences()
  const localStorageLoadedRef = useRef(false)

  // Prüfe beim initialen State, ob localStorage-Werte vorhanden sind
  useEffect(() => {
    if (isEmbedded || !isAnonymous) return
    if (typeof window === 'undefined') return

    try {
      const initialTargetLanguage = getInitialTargetLanguage()
      const initialCharacter = getInitialCharacter()
      const initialSocialContext = getInitialSocialContext()

      if (
        initialTargetLanguage !== TARGET_LANGUAGE_DEFAULT ||
        initialCharacter !== CHARACTER_DEFAULT ||
        initialSocialContext !== SOCIAL_CONTEXT_DEFAULT
      ) {
        localStorageLoadedRef.current = true
      }

      const hasLocalStorage =
        localStorage.getItem('story-context-targetLanguage') ||
        localStorage.getItem('story-context-character') ||
        localStorage.getItem('story-context-socialContext')

      if (hasLocalStorage && !localStorageLoadedRef.current) {
        localStorageLoadedRef.current = true
      }
    } catch {
      // Ignoriere Fehler
    }
  }, [isAnonymous, isEmbedded])

  // Setze Config-Werte basierend auf Priorität
  useEffect(() => {
    if (!cfg) return

    const configData = cfg.config as ChatConfigData
    const prefs = configData.userPreferences

    // Priorität: localStorage (anonym) > userPreferences > Config-Defaults
    if (hasLocalStorageValues && isAnonymous) {
      // localStorage-Werte haben Priorität - keine Config-Werte setzen
      localStorageLoadedRef.current = true
      return
    }

    // Keine localStorage-Werte vorhanden: Setze Config-Werte
    if (prefs?.targetLanguage) {
      setTargetLanguage(prefs.targetLanguage)
    } else if (configData.targetLanguage) {
      setTargetLanguage(configData.targetLanguage as TargetLanguage)
    }

    if (prefs?.character) {
      setCharacter(prefs.character)
    } else if (configData.character) {
      setCharacter(configData.character as Character)
    }

    if (prefs?.socialContext) {
      setSocialContext(prefs.socialContext)
    } else if (configData.socialContext) {
      setSocialContext(configData.socialContext as SocialContext)
    }

    if (prefs?.genderInclusive !== undefined) {
      setGenderInclusive(prefs.genderInclusive)
    } else if (configData.genderInclusive !== undefined) {
      setGenderInclusive(configData.genderInclusive)
    }
  }, [
    cfg,
    hasLocalStorageValues,
    isAnonymous,
    setTargetLanguage,
    setCharacter,
    setSocialContext,
    setGenderInclusive,
  ])

  return {
    cfg,
    localStorageLoaded: localStorageLoadedRef.current,
  }
}

