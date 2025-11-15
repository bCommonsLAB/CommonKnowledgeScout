/**
 * Hook für anonyme Nutzer-Präferenzen (LocalStorage)
 * 
 * Verwaltet das Lesen und Schreiben von Präferenzen im LocalStorage
 * für anonyme Nutzer. Wird sowohl im Chat als auch in der Gallery verwendet.
 */

import { useCallback, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'

interface AnonymousPreferences {
  targetLanguage?: string
  character?: string
  accessPerspective?: string
  socialContext?: string
  genderInclusive?: boolean
}

interface UseAnonymousPreferencesResult {
  /** Aktuelle Präferenz-Werte aus localStorage */
  values: AnonymousPreferences
  /** Prüft, ob localStorage-Werte vorhanden sind */
  hasValues: boolean
  /** Speichert Präferenzen im localStorage (nur für anonyme Nutzer) */
  save: (prefs: AnonymousPreferences) => void
}

const PREFERENCE_KEYS = {
  targetLanguage: 'story-context-targetLanguage',
  character: 'story-context-character',
  accessPerspective: 'story-context-accessPerspective',
  socialContext: 'story-context-socialContext',
  genderInclusive: 'story-context-genderInclusive',
} as const

/**
 * Hook für anonyme Nutzer-Präferenzen
 * 
 * Liest und schreibt Präferenzen im localStorage für anonyme Nutzer.
 * Für eingeloggte Nutzer werden keine localStorage-Werte verwaltet.
 * 
 * @returns Präferenz-Werte, Flag ob Werte vorhanden sind, und Save-Funktion
 */
export function useAnonymousPreferences(): UseAnonymousPreferencesResult {
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn

  // Lese Werte aus localStorage
  const values = useMemo<AnonymousPreferences>(() => {
    if (!isAnonymous || typeof window === 'undefined') {
      return {}
    }

    const prefs: AnonymousPreferences = {}
    try {
      const targetLanguage = localStorage.getItem(PREFERENCE_KEYS.targetLanguage)
      const character = localStorage.getItem(PREFERENCE_KEYS.character)
      const accessPerspective = localStorage.getItem(PREFERENCE_KEYS.accessPerspective)
      const socialContext = localStorage.getItem(PREFERENCE_KEYS.socialContext)
      const genderInclusive = localStorage.getItem(PREFERENCE_KEYS.genderInclusive)

      if (targetLanguage) {
        try {
          prefs.targetLanguage = JSON.parse(targetLanguage) as string
        } catch {
          // Ignoriere Parsing-Fehler
        }
      }
      if (character) {
        try {
          prefs.character = JSON.parse(character) as string
        } catch {
          // Ignoriere Parsing-Fehler
        }
      }
      if (accessPerspective) {
        try {
          prefs.accessPerspective = JSON.parse(accessPerspective) as string
        } catch {
          // Ignoriere Parsing-Fehler
        }
      }
      if (socialContext) {
        try {
          prefs.socialContext = JSON.parse(socialContext) as string
        } catch {
          // Ignoriere Parsing-Fehler
        }
      }
      if (genderInclusive !== null) {
        try {
          prefs.genderInclusive = JSON.parse(genderInclusive) as boolean
        } catch {
          // Ignoriere Parsing-Fehler
        }
      }
    } catch {
      // Bei Fehler: Leere Werte
    }

    return prefs
  }, [isAnonymous])

  const hasValues = useMemo(() => {
    return (
      values.targetLanguage !== undefined ||
      values.character !== undefined ||
      values.accessPerspective !== undefined ||
      values.socialContext !== undefined ||
      values.genderInclusive !== undefined
    )
  }, [values])

  const save = useCallback(
    (prefs: AnonymousPreferences) => {
      if (!isAnonymous || typeof window === 'undefined') {
        return
      }

      try {
        if (prefs.targetLanguage !== undefined) {
          localStorage.setItem(
            PREFERENCE_KEYS.targetLanguage,
            JSON.stringify(prefs.targetLanguage)
          )
        }
        if (prefs.character !== undefined) {
          localStorage.setItem(PREFERENCE_KEYS.character, JSON.stringify(prefs.character))
        }
        if (prefs.accessPerspective !== undefined) {
          localStorage.setItem(
            PREFERENCE_KEYS.accessPerspective,
            JSON.stringify(prefs.accessPerspective)
          )
        }
        if (prefs.socialContext !== undefined) {
          localStorage.setItem(
            PREFERENCE_KEYS.socialContext,
            JSON.stringify(prefs.socialContext)
          )
        }
        if (prefs.genderInclusive !== undefined) {
          localStorage.setItem(
            PREFERENCE_KEYS.genderInclusive,
            JSON.stringify(prefs.genderInclusive)
          )
        }
      } catch (error) {
        console.error('[useAnonymousPreferences] Fehler beim Speichern:', error)
      }
    },
    [isAnonymous]
  )

  return { values, hasValues, save }
}












