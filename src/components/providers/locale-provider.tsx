'use client'

/**
 * @fileoverview Locale Provider - Initialisiert Locale beim ersten Render
 * 
 * @description
 * Client Component, die beim Mount die Locale aus Cookie/URL liest
 * und in den Jotai State setzt. Wird im Root Layout eingebunden.
 */

import { useLayoutEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useSearchParams } from 'next/navigation'
import { localeAtom } from '@/atoms/i18n-atom'
import { getLocale, type Locale } from '@/lib/i18n'

interface LocaleProviderProps {
  children: React.ReactNode
}

/**
 * Provider-Komponente für Locale-Initialisierung
 * 
 * Liest die Locale SYNCHRON beim ersten Render aus Cookie/URL
 * und setzt sie in den Jotai State, um Flackern zu vermeiden.
 * 
 * OPTIMIERUNG: Verwendet useLayoutEffect statt useEffect für synchrones Setzen
 * vor dem Paint, um Flackern von falscher Sprache zu vermeiden.
 */
export function LocaleProvider({ children }: LocaleProviderProps) {
  const currentLocale = useAtomValue(localeAtom)
  const setLocale = useSetAtom(localeAtom)
  const searchParams = useSearchParams()
  const hasInitialized = useRef(false)

  // OPTIMIERUNG: useLayoutEffect statt useEffect für synchrones Setzen vor Paint
  useLayoutEffect(() => {
    // Nur einmal beim ersten Mount initialisieren
    if (hasInitialized.current) return
    
    // Lese Locale aus Cookie
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    
    // Ermittle Locale mit Priorität: URL > Cookie > Browser
    const newLocale = getLocale(
      searchParams?.toString(),
      cookieValue,
      navigator.language
    ) as Locale
    
    // Setze Locale synchron (auch wenn gleich, um sicherzustellen dass URL-Parameter berücksichtigt werden)
    if (newLocale !== currentLocale) {
      setLocale(newLocale)
    }
    
    hasInitialized.current = true
  }, []) // Leeres Dependency-Array: Nur beim ersten Mount

  // Reagiere auf URL-Änderungen (z.B. wenn User ?lang=de zu ?lang=fr wechselt)
  useLayoutEffect(() => {
    if (!hasInitialized.current) return // Skip beim ersten Mount (wird oben behandelt)
    
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    
    const newLocale = getLocale(
      searchParams?.toString(),
      cookieValue,
      navigator.language
    ) as Locale
    
    if (newLocale !== currentLocale) {
      setLocale(newLocale)
    }
  }, [searchParams, setLocale, currentLocale])

  return <>{children}</>
}

