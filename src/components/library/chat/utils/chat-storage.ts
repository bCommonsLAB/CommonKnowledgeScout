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
 * Liest einen JSON-Wert sicher aus localStorage.
 * Gibt null zurueck, wenn der Schluessel fehlt oder JSON ungueltig ist.
 * Loggt einen Warn-Level-Eintrag bei JSON-Parse-Fehlern.
 */
function safeGetLocalStorage(key: string, context: string): unknown | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return null
    return JSON.parse(stored)
  } catch (error) {
    // localStorage nicht verfuegbar oder gespeicherter JSON ungueltig — Default wird verwendet
    console.warn(`[chat-storage] ${context}: localStorage-Fehler fuer Schluessel "${key}":`, error)
    return null
  }
}

/**
 * Lädt initiale Werte aus localStorage (client-side only).
 * Alle getInitial*-Funktionen sind reine Helfer ohne Seiteneffekte ausser localStorage-Lesen.
 */
export function getInitialTargetLanguage(): TargetLanguage {
  const parsed = safeGetLocalStorage('story-context-targetLanguage', 'getInitialTargetLanguage')
  if (parsed !== null) return parsed as TargetLanguage
  return TARGET_LANGUAGE_DEFAULT
}

export function getInitialCharacter(): Character[] {
  const parsed = safeGetLocalStorage('story-context-character', 'getInitialCharacter')
  if (parsed !== null) {
    // Migration: Konvertiere Single-Value zu Array (Altdaten-Kompatibilitaet)
    if (Array.isArray(parsed)) return parsed as Character[]
    if (typeof parsed === 'string') return [parsed as Character]
  }
  return CHARACTER_DEFAULT
}

export function getInitialAccessPerspective(): AccessPerspective[] {
  const parsed = safeGetLocalStorage('story-context-accessPerspective', 'getInitialAccessPerspective')
  if (parsed !== null) {
    // Migration: Konvertiere Single-Value zu Array (Altdaten-Kompatibilitaet)
    if (Array.isArray(parsed)) return parsed as AccessPerspective[]
    if (typeof parsed === 'string') return [parsed as AccessPerspective]
  }
  return ACCESS_PERSPECTIVE_DEFAULT
}

export function getInitialSocialContext(): SocialContext {
  const parsed = safeGetLocalStorage('story-context-socialContext', 'getInitialSocialContext')
  if (parsed !== null) return parsed as SocialContext
  return SOCIAL_CONTEXT_DEFAULT
}

export function getInitialGenderInclusive(): boolean {
  const parsed = safeGetLocalStorage('story-context-genderInclusive', 'getInitialGenderInclusive')
  if (parsed !== null) return parsed as boolean
  return GENDER_INCLUSIVE_DEFAULT
}

export function getInitialLlmModel(): LlmModelId {
  const parsed = safeGetLocalStorage('story-context-llmModel', 'getInitialLlmModel')
  if (parsed !== null) return parsed as LlmModelId
  return LLM_MODEL_DEFAULT
}

/**
 * Speichert Chat-Kontext-Werte im localStorage.
 * Fehler werden geloggt; das Speichern ist Best-Effort (kein kritischer Pfad).
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
