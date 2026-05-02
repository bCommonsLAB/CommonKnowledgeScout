import {
  type TargetLanguage,
  type Character,
  type AccessPerspective,
  type SocialContext,
  type LlmModelId,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  ACCESS_PERSPECTIVE_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
  GENDER_INCLUSIVE_DEFAULT,
  LLM_MODEL_DEFAULT,
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
  } catch (error) {
    // localStorage nicht verfuegbar oder JSON ungueltig — Default zurueckgeben
    console.warn('[chat-storage] getInitialTargetLanguage: localStorage-Fehler:', error)
  }
  return TARGET_LANGUAGE_DEFAULT
}

export function getInitialCharacter(): Character[] {
  if (typeof window === 'undefined') return CHARACTER_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-character')
    if (stored) {
      const parsed = JSON.parse(stored)
      // Migration: Konvertiere Single-Value zu Array
      if (Array.isArray(parsed)) {
        return parsed as Character[]
      }
      // Alte Single-Value-Werte zu Array konvertieren
      if (typeof parsed === 'string') {
        return [parsed as Character]
      }
    }
  } catch (error) {
    // localStorage nicht verfuegbar oder JSON ungueltig — Default zurueckgeben
    console.warn('[chat-storage] getInitialCharacter: localStorage-Fehler:', error)
  }
  return CHARACTER_DEFAULT
}

export function getInitialAccessPerspective(): AccessPerspective[] {
  if (typeof window === 'undefined') return ACCESS_PERSPECTIVE_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-accessPerspective')
    if (stored) {
      const parsed = JSON.parse(stored)
      // Migration: Konvertiere Single-Value zu Array
      if (Array.isArray(parsed)) {
        return parsed as AccessPerspective[]
      }
      // Alte Single-Value-Werte zu Array konvertieren
      if (typeof parsed === 'string') {
        return [parsed as AccessPerspective]
      }
    }
  } catch (error) {
    // localStorage nicht verfuegbar oder JSON ungueltig — Default zurueckgeben
    console.warn('[chat-storage] getInitialAccessPerspective: localStorage-Fehler:', error)
  }
  return ACCESS_PERSPECTIVE_DEFAULT
}

export function getInitialSocialContext(): SocialContext {
  if (typeof window === 'undefined') return SOCIAL_CONTEXT_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-socialContext')
    if (stored) {
      const parsed = JSON.parse(stored) as SocialContext
      return parsed
    }
  } catch (error) {
    // localStorage nicht verfuegbar oder JSON ungueltig — Default zurueckgeben
    console.warn('[chat-storage] getInitialSocialContext: localStorage-Fehler:', error)
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
  } catch (error) {
    // localStorage nicht verfuegbar oder JSON ungueltig — Default zurueckgeben
    console.warn('[chat-storage] getInitialGenderInclusive: localStorage-Fehler:', error)
  }
  return GENDER_INCLUSIVE_DEFAULT
}

export function getInitialLlmModel(): LlmModelId {
  if (typeof window === 'undefined') return LLM_MODEL_DEFAULT
  try {
    const stored = localStorage.getItem('story-context-llmModel')
    if (stored) {
      const parsed = JSON.parse(stored) as LlmModelId
      return parsed
    }
  } catch (error) {
    // localStorage nicht verfuegbar oder JSON ungueltig — Default zurueckgeben
    console.warn('[chat-storage] getInitialLlmModel: localStorage-Fehler:', error)
  }
  return LLM_MODEL_DEFAULT
}

/**
 * Speichert Chat-Kontext-Werte im localStorage
 */
export function saveChatContextToLocalStorage(
  targetLanguage: TargetLanguage,
  character: Character[], // Array (kann leer sein)
  accessPerspective: AccessPerspective[], // Array (kann leer sein)
  socialContext: SocialContext,
  genderInclusive: boolean,
  llmModel: LlmModelId
): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('story-context-targetLanguage', JSON.stringify(targetLanguage))
    localStorage.setItem('story-context-character', JSON.stringify(character))
    localStorage.setItem('story-context-accessPerspective', JSON.stringify(accessPerspective))
    localStorage.setItem('story-context-socialContext', JSON.stringify(socialContext))
    localStorage.setItem('story-context-genderInclusive', JSON.stringify(genderInclusive))
    localStorage.setItem('story-context-llmModel', JSON.stringify(llmModel))
  } catch (error) {
    console.error('[chat-storage] Fehler beim Speichern in localStorage:', error)
  }
}



