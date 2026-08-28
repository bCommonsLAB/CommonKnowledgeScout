'use client'

/**
 * React Hook für Client Components
 * 
 * Verwendet die i18n-Utility-Funktionen in React-Komponenten
 * Liest Locale aus Jotai State statt direkt aus Cookie
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import { localeAtom } from './locale-atom'
import { t, type Locale } from '../core'

/**
 * Hook zum Abrufen der aktuellen Sprache und Übersetzungsfunktion
 * 
 * Liest Locale aus Jotai State (wird vom LocaleProvider initialisiert)
 * 
 * @returns Objekt mit `locale` und `t` Funktion
 */
export function useTranslation() {
  // Lese Locale aus Jotai State
  const locale = useAtomValue(localeAtom)
  
  /**
   * Übersetzungsfunktion für Client Components
   */
  const translate = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => {
      return t(locale, key, params)
    }
  }, [locale])
  
  return {
    locale,
    t: translate,
  }
}

/**
 * Spiegelt eine BEREITS ERMITTELTE Sprache in den State — mehr nicht.
 *
 * Abgrenzung zu `useSetLocale()`: Dort waehlt der NUTZER eine Sprache, deshalb
 * schreibt es zusaetzlich das Cookie und laedt die Seite neu. Hier ist die
 * Sprache schon bekannt (aus URL, Cookie oder Browser) und wird nur in den
 * State uebernommen. Die beiden zu verwechseln erzeugt eine Reload-Schleife.
 */
export function useApplyLocale() {
  return useSetAtom(localeAtom)
}

/**
 * Hook zum Setzen der Sprache durch den NUTZER.
 * 
 * Setzt Jotai State, Cookie — und laedt die Seite neu, damit die Sprache
 * ueberall greift. Wer nur den State spiegeln will, nimmt `useApplyLocale()`.
 */
export function useSetLocale() {
  const setLocaleAtom = useSetAtom(localeAtom)
  
  const setLocale = (locale: Locale) => {
    // Setze Jotai State
    setLocaleAtom(locale)
    
    // Cookie setzen (30 Tage Gültigkeit)
    const expires = new Date()
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000)
    document.cookie = `locale=${locale}; expires=${expires.toUTCString()}; path=/`
    
    // Seite neu laden um Sprache anzuwenden
    const url = new URL(window.location.href)
    url.searchParams.set('lang', locale)
    window.location.href = url.toString()
  }
  
  return setLocale
}

