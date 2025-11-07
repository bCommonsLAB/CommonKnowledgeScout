'use client'

/**
 * React Hook für Client Components
 * 
 * Verwendet die i18n-Utility-Funktionen in React-Komponenten
 */

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { getLocale, t, type Locale } from './index'

/**
 * Hook zum Abrufen der aktuellen Sprache und Übersetzungsfunktion
 * 
 * @returns Objekt mit `locale` und `t` Funktion
 */
export function useTranslation() {
  const searchParams = useSearchParams()
  
  // Ermittle aktuelle Sprache
  const locale = useMemo(() => {
    // Versuche Cookie zu lesen (wird vom Server gesetzt)
    const cookieValue = typeof document !== 'undefined' 
      ? document.cookie
        .split('; ')
        .find(row => row.startsWith('locale='))
        ?.split('=')[1]
      : undefined
    
    return getLocale(
      searchParams?.toString(),
      cookieValue,
      typeof navigator !== 'undefined' ? navigator.language : undefined
    )
  }, [searchParams])
  
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
 * Hook zum Setzen der Sprache (speichert in Cookie)
 */
export function useSetLocale() {
  const setLocale = (locale: Locale) => {
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

