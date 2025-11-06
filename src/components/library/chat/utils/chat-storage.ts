import {
  type TargetLanguage,
  type Character,
  type SocialContext,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
  GENDER_INCLUSIVE_DEFAULT,
} from '@/lib/chat/constants'

/**
 * Lädt initiale Werte aus localStorage (client-side only)
 */
export function getInitialTargetLanguage(): TargetLanguage {
  if (typeof window === 'undefined') return TARGET_LANGUAGE_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-targetLanguage')
    if (stored) {
      const parsed = JSON.parse(stored) as TargetLanguage
      return parsed
    }
  } catch {
    // Ignoriere Fehler
  }
  return TARGET_LANGUAGE_DEFAULT
}

export function getInitialCharacter(): Character {
  if (typeof window === 'undefined') return CHARACTER_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-character')
    if (stored) {
      const parsed = JSON.parse(stored) as Character
      return parsed
    }
  } catch {
    // Ignoriere Fehler
  }
  return CHARACTER_DEFAULT
}

export function getInitialSocialContext(): SocialContext {
  if (typeof window === 'undefined') return SOCIAL_CONTEXT_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-socialContext')
    if (stored) {
      const parsed = JSON.parse(stored) as SocialContext
      return parsed
    }
  } catch {
    // Ignoriere Fehler
  }
  return SOCIAL_CONTEXT_DEFAULT
}

export function getInitialGenderInclusive(): boolean {
  if (typeof window === 'undefined') return GENDER_INCLUSIVE_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-genderInclusive')
    if (stored !== null) {
      const parsed = JSON.parse(stored) as boolean
      return parsed
    }
  } catch {
    // Ignoriere Fehler
  }
  return GENDER_INCLUSIVE_DEFAULT
}

/**
 * Speichert Chat-Kontext-Werte im localStorage
 */
export function saveChatContextToLocalStorage(
  targetLanguage: TargetLanguage,
  character: Character,
  socialContext: SocialContext,
  genderInclusive: boolean
): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('story-context-targetLanguage', JSON.stringify(targetLanguage))
    localStorage.setItem('story-context-character', JSON.stringify(character))
    localStorage.setItem('story-context-socialContext', JSON.stringify(socialContext))
    localStorage.setItem('story-context-genderInclusive', JSON.stringify(genderInclusive))
  } catch (error) {
    console.error('[chat-storage] Fehler beim Speichern in localStorage:', error)
  }
}

