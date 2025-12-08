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
  type AccessPerspective,
  TARGET_LANGUAGE_VALUES,
  CHARACTER_VALUES,
  SOCIAL_CONTEXT_VALUES,
  ACCESS_PERSPECTIVE_VALUES,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
  ACCESS_PERSPECTIVE_DEFAULT,
  normalizeCharacterToArray,
  normalizeAccessPerspectiveToArray,
} from '@/lib/chat/constants'
import {
  storyTargetLanguageAtom,
  storyCharacterAtom,
  storySocialContextAtom,
  storyAccessPerspectiveAtom,
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
function useLocalStorageSync<T extends TargetLanguage | Character[] | SocialContext | AccessPerspective[]>(
  atom: typeof storyTargetLanguageAtom | typeof storyCharacterAtom | typeof storySocialContextAtom | typeof storyAccessPerspectiveAtom,
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
        const parsed = JSON.parse(stored)
        // Für Character und AccessPerspective: Normalisiere zu Array (Backward-Compatibility)
        let normalized: T
        if (storageKey.includes('character')) {
          normalized = normalizeCharacterToArray(parsed) as T
        } else if (storageKey.includes('accessPerspective')) {
          normalized = normalizeAccessPerspectiveToArray(parsed) as T
        } else {
          normalized = parsed as T
        }
        
        // Nur setzen, wenn der Wert anders ist (verhindert unnötige Updates)
        // Für Arrays: Deep-Vergleich
        const isEqual = Array.isArray(normalized) && Array.isArray(typedValue)
          ? JSON.stringify(normalized) === JSON.stringify(typedValue)
          : normalized === typedValue
        
        if (!isEqual) {
          console.log(`[StoryContext] Lade ${storageKey} aus localStorage (useEffect):`, normalized)
          typedSetValue(normalized as T)
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
 * Speichere alle StoryContext-Werte im localStorage
 * 
 * WICHTIG: Speichert für alle Benutzer (anonym und eingeloggt), damit die Perspektivwahl
 * beim nächsten Besuch erhalten bleibt. Für eingeloggte Benutzer könnten die Werte
 * später auch in der Datenbank gespeichert werden, aber localStorage ist schneller
 * und funktioniert sofort.
 */
export function saveStoryContextToLocalStorage(
  targetLanguage: TargetLanguage,
  character: Character[],
  socialContext: SocialContext,
  accessPerspective: AccessPerspective[],
  isAnonymous: boolean
): void {
  // WICHTIG: Speichere für alle Benutzer, nicht nur anonyme
  // Die isAnonymous-Parameter wird behalten für zukünftige Erweiterungen (z.B. DB-Speicherung)
  if (typeof window === 'undefined') return
  
  try {
    const previousTargetLanguage = localStorage.getItem(`${STORAGE_KEY_PREFIX}targetLanguage`)
    const previousPerspectiveSet = localStorage.getItem('story-perspective-set') === 'true'
    
    localStorage.setItem(`${STORAGE_KEY_PREFIX}targetLanguage`, JSON.stringify(targetLanguage))
    localStorage.setItem(`${STORAGE_KEY_PREFIX}character`, JSON.stringify(character))
    localStorage.setItem(`${STORAGE_KEY_PREFIX}socialContext`, JSON.stringify(socialContext))
    localStorage.setItem(`${STORAGE_KEY_PREFIX}accessPerspective`, JSON.stringify(accessPerspective))
    
    // Setze Flag, dass Perspektive gesetzt wurde (falls noch nicht gesetzt)
    if (!previousPerspectiveSet) {
      localStorage.setItem('story-perspective-set', 'true')
      console.log('[StoryContext] Flag "story-perspective-set" gesetzt')
    }
    
    console.log('[StoryContext] Speichere Werte in localStorage:', {
      targetLanguage,
      previousTargetLanguage: previousTargetLanguage ? JSON.parse(previousTargetLanguage) : null,
      character,
      socialContext,
      accessPerspective,
      isAnonymous,
      perspectiveSet: true,
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
  /** Aktuelle Charaktere/Perspektiven (Array mit max. 3 Werten) */
  character: Character[];
  /** Setter für Charaktere */
  setCharacter: (value: Character[]) => void;
  /** Aktuelle Zugangsperspektiven (Array mit max. 3 Werten) */
  accessPerspective: AccessPerspective[];
  /** Setter für Zugangsperspektiven */
  setAccessPerspective: (value: AccessPerspective[]) => void;
  /** Aktueller Sozialer Kontext */
  socialContext: SocialContext;
  /** Setter für Sozialen Kontext */
  setSocialContext: (value: SocialContext) => void;
  /** Labels für alle verfügbaren Sprachen */
  targetLanguageLabels: Record<TargetLanguage, string>;
  /** Labels für alle verfügbaren Charaktere */
  characterLabels: Record<Character, string>;
  /** Labels für alle verfügbaren Zugangsperspektiven */
  accessPerspectiveLabels: Record<AccessPerspective, string>;
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
 * Mapping von UI-Locale zu Chat-Zielsprache
 * Unterstützt alle verfügbaren Zielsprachen
 */
function localeToTargetLanguage(locale: string): TargetLanguage {
  const mapping: Record<string, TargetLanguage> = {
    // UI-Locales zu Chat-Zielsprachen
    de: 'de',
    en: 'en',
    it: 'it',
    fr: 'fr',
    es: 'es',
    // Weitere Mappings für Browser-Locales
    pt: 'pt',
    nl: 'nl',
    no: 'no',
    da: 'da',
    sv: 'sv',
    fi: 'fi',
    pl: 'pl',
    cs: 'cs',
    hu: 'hu',
    ro: 'ro',
    bg: 'bg',
    el: 'el',
    tr: 'tr',
    ru: 'ru',
    uk: 'uk',
    zh: 'zh',
    ko: 'ko',
    ja: 'ja',
    hr: 'hr',
    sr: 'sr',
    bs: 'bs',
    sl: 'sl',
    sk: 'sk',
    lt: 'lt',
    lv: 'lv',
    et: 'et',
    id: 'id',
    ms: 'ms',
    hi: 'hi',
    sw: 'sw',
    yo: 'yo',
    zu: 'zu',
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
  // WICHTIG: Überschreibe NICHT die gespeicherte Sprache, wenn die Perspektive bereits gesetzt wurde
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}targetLanguage`)
      const perspectiveSet = localStorage.getItem('story-perspective-set') === 'true'
      const uiLanguage = localeToTargetLanguage(locale)
      
      console.log('[StoryContext] useEffect targetLanguage Sync Check:', {
        stored: stored ? JSON.parse(stored) : null,
        perspectiveSet,
        uiLanguage,
        currentTargetLanguage: targetLanguage,
        locale,
        isInitialMount: isInitialMount.current,
      })
      
      if (!stored) {
        // Kein gespeicherter Wert: Setze auf aktuelle UI-Sprache
        if (targetLanguage !== uiLanguage) {
          console.log('[StoryContext] Kein gespeicherter Wert - setze auf UI-Sprache:', uiLanguage)
          setTargetLanguage(uiLanguage)
        }
      } else if (isInitialMount.current) {
        // Beim ersten Mount: Prüfe ob die Perspektive bereits gesetzt wurde
        const storedValue = JSON.parse(stored) as TargetLanguage
        
        if (perspectiveSet) {
          // Perspektive wurde bereits gesetzt - verwende gespeicherten Wert, überschreibe NICHT
          console.log('[StoryContext] Perspektive bereits gesetzt - verwende gespeicherte Sprache:', storedValue, '(UI-Sprache würde sein:', uiLanguage, ')')
          if (targetLanguage !== storedValue) {
            console.log('[StoryContext] Synchronisiere targetLanguage mit gespeichertem Wert:', storedValue)
            setTargetLanguage(storedValue)
          }
        } else {
          // Perspektive noch nicht gesetzt - prüfe ob gespeicherter Wert mit UI-Sprache übereinstimmt
          if (storedValue !== uiLanguage && targetLanguage === storedValue) {
            // Gespeicherter Wert entspricht nicht der aktuellen UI-Sprache
            // Aktualisiere auf UI-Sprache (nur wenn Perspektive noch nicht gesetzt wurde)
            console.log('[StoryContext] Perspektive noch nicht gesetzt - aktualisiere auf UI-Sprache:', uiLanguage, '(gespeichert war:', storedValue, ')')
            setTargetLanguage(uiLanguage)
          } else {
            console.log('[StoryContext] Gespeicherter Wert wird beibehalten:', storedValue, '(UI-Sprache:', uiLanguage, ')')
          }
        }
        isInitialMount.current = false
      }
    } catch (error) {
      console.error('[StoryContext] Fehler beim Synchronisieren der targetLanguage:', error)
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

  const [accessPerspective, setAccessPerspective] = useLocalStorageSync(
    storyAccessPerspectiveAtom,
    `${STORAGE_KEY_PREFIX}accessPerspective`,
    ACCESS_PERSPECTIVE_DEFAULT,
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

  // Übersetzte Labels für AccessPerspective
  const accessPerspectiveLabels = useMemo(() => {
    const labels: Record<AccessPerspective, string> = {} as Record<AccessPerspective, string>
    for (const ap of ACCESS_PERSPECTIVE_VALUES) {
      labels[ap] = t(`chat.accessPerspectiveLabels.${ap}`)
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
    accessPerspective,
    setAccessPerspective,
    socialContext,
    setSocialContext,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
  };
}

