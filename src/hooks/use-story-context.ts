/**
 * Hook für die Verwaltung des Story-Kontexts (Sprache, Perspektive, Sozialkontext).
 * 
 * Verwaltet die Werte über Jotai Atoms für einfaches State-Management
 * innerhalb der Anwendung.
 * 
 * Im anonymen Modus werden die Werte im localStorage gespeichert,
 * damit sie beim Neuladen erhalten bleiben.
 */

'use client'

import { useAtom } from 'jotai'
import { useEffect, useMemo, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  type TargetLanguage,
  type Character,
  type SocialContext,
  TARGET_LANGUAGE_VALUES,
  CHARACTER_VALUES,
  SOCIAL_CONTEXT_VALUES,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
} from '@/lib/chat/constants'
import {
  storyTargetLanguageAtom,
  storyCharacterAtom,
  storySocialContextAtom,
} from '@/atoms/story-context-atom'
import { useTranslation } from '@/lib/i18n/hooks'

const STORAGE_KEY_PREFIX = 'story-context-'

// Globale Refs für einmaliges Laden (geteilt über alle Hook-Instanzen)
const loadedStorageKeys = new Set<string>()

/**
 * Hook für localStorage-Persistenz im anonymen Modus
 * 
 * WICHTIG: Speichert NICHT automatisch - nur beim Laden werden Werte gelesen.
 * Speichern muss manuell ausgelöst werden (z.B. beim Schließen des Dialogs).
 * 
 * Da die Atoms bereits mit localStorage-Werten initialisiert werden,
 * müssen wir hier nur noch einmal prüfen, ob Werte aktualisiert werden müssen
 * (für den Fall, dass localStorage später verfügbar wird oder sich ändert).
 */
function useLocalStorageSync<T extends TargetLanguage | Character | SocialContext>(
  atom: typeof storyTargetLanguageAtom | typeof storyCharacterAtom | typeof storySocialContextAtom,
  storageKey: string,
  defaultValue: T,
  isAnonymous: boolean
): [T, (value: T) => void] {
  const [value, setValue] = useAtom(atom)
  
  // Cast zu T, da die Atoms die richtigen Typen haben
  const typedValue = value as T
  const typedSetValue = setValue as (value: T) => void
  
  // Beim Laden: Werte aus localStorage lesen (nur im anonymen Modus, nur einmal pro Key)
  // WICHTIG: Die Atoms werden bereits mit localStorage-Werten initialisiert,
  // aber wir prüfen hier nochmal für den Fall, dass localStorage später verfügbar wird
  useEffect(() => {
    if (!isAnonymous || loadedStorageKeys.has(storageKey)) return
    
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as T
        // Nur setzen, wenn der Wert anders ist (verhindert unnötige Updates)
        if (parsed !== typedValue) {
          console.log(`[StoryContext] Lade ${storageKey} aus localStorage (useEffect):`, parsed)
          typedSetValue(parsed)
        }
      }
      loadedStorageKeys.add(storageKey) // Markiere als geladen
    } catch (error) {
      console.error(`[StoryContext] Fehler beim Laden von ${storageKey} aus localStorage:`, error)
      loadedStorageKeys.add(storageKey) // Markiere auch bei Fehler als geladen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnonymous, storageKey])
  
  return [typedValue, typedSetValue]
}

/**
 * Speichere alle StoryContext-Werte im localStorage (nur im anonymen Modus)
 */
export function saveStoryContextToLocalStorage(
  targetLanguage: TargetLanguage,
  character: Character,
  socialContext: SocialContext,
  isAnonymous: boolean
): void {
  if (!isAnonymous || typeof window === 'undefined') return
  
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}targetLanguage`, JSON.stringify(targetLanguage))
    localStorage.setItem(`${STORAGE_KEY_PREFIX}character`, JSON.stringify(character))
    localStorage.setItem(`${STORAGE_KEY_PREFIX}socialContext`, JSON.stringify(socialContext))
    console.log('[StoryContext] Speichere Werte in localStorage:', {
      targetLanguage,
      character,
      socialContext,
    })
  } catch (error) {
    console.error('[StoryContext] Fehler beim Speichern in localStorage:', error)
  }
}

/**
 * Rückgabewert des Hooks mit aktuellen Werten und Settern.
 */
export interface UseStoryContextReturn {
  /** Aktuelle Zielsprache */
  targetLanguage: TargetLanguage;
  /** Setter für Zielsprache */
  setTargetLanguage: (value: TargetLanguage) => void;
  /** Aktueller Charakter/Perspektive */
  character: Character;
  /** Setter für Charakter */
  setCharacter: (value: Character) => void;
  /** Aktueller Sozialer Kontext */
  socialContext: SocialContext;
  /** Setter für Sozialen Kontext */
  setSocialContext: (value: SocialContext) => void;
  /** Labels für alle verfügbaren Sprachen */
  targetLanguageLabels: Record<TargetLanguage, string>;
  /** Labels für alle verfügbaren Charaktere */
  characterLabels: Record<Character, string>;
  /** Labels für alle verfügbaren Sozialkontexte */
  socialContextLabels: Record<SocialContext, string>;
}

/**
 * Hook für die Verwaltung des Story-Kontexts über Jotai Atoms.
 * 
 * Die Werte werden in Jotai Atoms gespeichert und können von
 * mehreren Komponenten gemeinsam genutzt werden.
 * 
 * Im anonymen Modus werden die Werte zusätzlich im localStorage gespeichert,
 * damit sie beim Neuladen erhalten bleiben.
 * 
 * @returns Objekt mit aktuellen Werten, Settern und Labels
 */
/**
 * Konvertiert eine Locale (aus i18n) zu einer TargetLanguage (für Chat)
 * 
 * Mapping:
 * - 'de' -> 'de'
 * - 'en' -> 'en'
 * - 'it' -> 'it'
 * - 'fr' -> 'fr'
 * - 'es' -> 'es'
 * - Fallback -> TARGET_LANGUAGE_DEFAULT ('de')
 */
function localeToTargetLanguage(locale: string): TargetLanguage {
  const mapping: Record<string, TargetLanguage> = {
    de: 'de',
    en: 'en',
    it: 'it',
    fr: 'fr',
    es: 'es',
  }
  return mapping[locale] || TARGET_LANGUAGE_DEFAULT
}

export function useStoryContext(): UseStoryContextReturn {
  const { t, locale } = useTranslation()
  // Prüfe, ob Benutzer anonym ist
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  
  // Bestimme Default basierend auf aktueller UI-Sprache
  const defaultTargetLanguage = useMemo(() => {
    return localeToTargetLanguage(locale)
  }, [locale])
  
  // Verwende localStorage-Persistenz im anonymen Modus
  const [targetLanguage, setTargetLanguage] = useLocalStorageSync(
    storyTargetLanguageAtom,
    `${STORAGE_KEY_PREFIX}targetLanguage`,
    defaultTargetLanguage,
    isAnonymous
  )
  
  // Synchronisiere targetLanguage mit UI-Sprache beim ersten Laden
  // Wenn noch kein Wert im localStorage gespeichert ist, verwende die UI-Sprache
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}targetLanguage`)
      const uiLanguage = localeToTargetLanguage(locale)
      
      if (!stored) {
        // Kein gespeicherter Wert: Setze auf aktuelle UI-Sprache
        if (targetLanguage !== uiLanguage) {
          setTargetLanguage(uiLanguage)
        }
      } else if (isInitialMount.current) {
        // Beim ersten Mount: Prüfe ob der gespeicherte Wert mit der UI-Sprache übereinstimmt
        // Wenn nicht, aktualisiere auf UI-Sprache (UI-Sprache hat sich geändert seit dem letzten Besuch)
        const storedValue = JSON.parse(stored) as TargetLanguage
        if (storedValue !== uiLanguage && targetLanguage === storedValue) {
          // Gespeicherter Wert entspricht nicht der aktuellen UI-Sprache
          // Aktualisiere auf UI-Sprache
          setTargetLanguage(uiLanguage)
        }
        isInitialMount.current = false
      }
    } catch {
      // Ignoriere Fehler
    }
  }, [locale, targetLanguage, setTargetLanguage])
  
  const [character, setCharacter] = useLocalStorageSync(
    storyCharacterAtom,
    `${STORAGE_KEY_PREFIX}character`,
    CHARACTER_DEFAULT,
    isAnonymous
  )
  
  const [socialContext, setSocialContext] = useLocalStorageSync(
    storySocialContextAtom,
    `${STORAGE_KEY_PREFIX}socialContext`,
    SOCIAL_CONTEXT_DEFAULT,
    isAnonymous
  )

  // Übersetzte Labels für Character
  const characterLabels = useMemo(() => {
    const labels: Record<Character, string> = {} as Record<Character, string>
    for (const char of CHARACTER_VALUES) {
      labels[char] = t(`chat.characterLabels.${char}`)
    }
    return labels
  }, [t])

  // Übersetzte Labels für SocialContext
  const socialContextLabels = useMemo(() => {
    const labels: Record<SocialContext, string> = {} as Record<SocialContext, string>
    for (const ctx of SOCIAL_CONTEXT_VALUES) {
      labels[ctx] = t(`chat.socialContextLabels.${ctx}`)
    }
    return labels
  }, [t])

  // Übersetzte Labels für TargetLanguage
  const targetLanguageLabels = useMemo(() => {
    const labels: Record<TargetLanguage, string> = {} as Record<TargetLanguage, string>
    for (const lang of TARGET_LANGUAGE_VALUES) {
      labels[lang] = t(`chat.languageLabels.${lang}`)
    }
    return labels
  }, [t])

  return {
    targetLanguage,
    setTargetLanguage,
    character,
    setCharacter,
    socialContext,
    setSocialContext,
    targetLanguageLabels,
    characterLabels,
    socialContextLabels,
  };
}

