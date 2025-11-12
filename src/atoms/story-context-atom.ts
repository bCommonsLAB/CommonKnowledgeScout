/**
 * Jotai Atoms für Story-Kontext (Sprache, Perspektive, Sozialkontext).
 * 
 * Diese Atome werden für die Story-Ansicht verwendet und können
 * von mehreren Komponenten gemeinsam genutzt werden.
 * 
 * Im anonymen Modus werden die initialen Werte aus localStorage geladen.
 */

import { atom } from 'jotai'
import {
  type TargetLanguage,
  type Character,
  type SocialContext,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
} from '@/lib/chat/constants'

/**
 * Konvertiert eine Locale (aus i18n Cookie) zu einer TargetLanguage (für Chat)
 * 
 * Mapping:
 * - 'de' -> 'de'
 * - 'en' -> 'en'
 * - 'it' -> 'it'
 * - 'fr' -> 'fr'
 * - 'es' -> 'es'
 * - Fallback -> TARGET_LANGUAGE_DEFAULT ('de')
 */
function localeToTargetLanguage(locale: string | null | undefined): TargetLanguage {
  if (!locale) return TARGET_LANGUAGE_DEFAULT
  const mapping: Record<string, TargetLanguage> = {
    de: 'de',
    en: 'en',
    it: 'it',
    fr: 'fr',
    es: 'es',
  }
  return mapping[locale] || TARGET_LANGUAGE_DEFAULT
}

/**
 * Liest die UI-Sprache aus dem Cookie
 * 
 * WICHTIG: Diese Funktion liest direkt aus dem Cookie, da get() in Jotai 2.x
 * nicht direkt verfügbar ist außerhalb von Atom-Definitionen.
 */
function getUILocaleFromAtom(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    return cookieValue || null
  } catch {
    return null
  }
}

// Helper-Funktionen: Lade initiale Werte aus localStorage (client-side only)
function getInitialTargetLanguage(): TargetLanguage {
  if (typeof window === 'undefined') return TARGET_LANGUAGE_DEFAULT
  try {
    // 1. Prüfe localStorage (benutzerdefinierte Einstellung hat Priorität)
    const stored = localStorage.getItem('story-context-targetLanguage')
    if (stored) {
      const parsed = JSON.parse(stored) as TargetLanguage
      return parsed
    }
    
    // 2. Kein localStorage-Wert: Verwende UI-Sprache aus localeAtom
    const uiLocale = getUILocaleFromAtom()
    if (uiLocale) {
      return localeToTargetLanguage(uiLocale)
    }
  } catch {
    // Ignoriere Fehler
  }
  return TARGET_LANGUAGE_DEFAULT
}

function getInitialCharacter(): Character {
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

function getInitialSocialContext(): SocialContext {
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

/**
 * Atom für die Zielsprache im Story-Modus.
 * Initialisiert mit Wert aus localStorage (falls vorhanden).
 */
export const storyTargetLanguageAtom = atom<TargetLanguage>(getInitialTargetLanguage())
storyTargetLanguageAtom.debugLabel = 'storyTargetLanguageAtom'

/**
 * Atom für den Charakter/Perspektive im Story-Modus.
 * Initialisiert mit Wert aus localStorage (falls vorhanden).
 */
export const storyCharacterAtom = atom<Character>(getInitialCharacter())
storyCharacterAtom.debugLabel = 'storyCharacterAtom'

/**
 * Atom für den Sozialen Kontext im Story-Modus.
 * Initialisiert mit Wert aus localStorage (falls vorhanden).
 */
export const storySocialContextAtom = atom<SocialContext>(getInitialSocialContext())
storySocialContextAtom.debugLabel = 'storySocialContextAtom'

/**
 * Atom für den Zustand des Perspektive-Popovers im Story-Modus.
 * true = Popover ist geöffnet, false = Popover ist geschlossen
 */
export const storyPerspectiveOpenAtom = atom<boolean>(false)
storyPerspectiveOpenAtom.debugLabel = 'storyPerspectiveOpenAtom'

