'use client'

/**
 * @fileoverview Locale Initializer - Setzt Locale synchron beim ersten Render
 * 
 * @description
 * Client Component, die die Locale aus URL-Parametern synchron beim ersten Render setzt.
 * Wird von Server Components verwendet, um die Locale vor dem Rendering zu initialisieren.
 * 
 * OPTIMIERUNG: Verwendet useLayoutEffect für synchrones Setzen vor Paint,
 * um Hydration-Mismatches zu vermeiden.
 */

import { useLayoutEffect, useRef } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { localeAtom } from '@/atoms/i18n-atom'
import { getLocale, type Locale } from '@/lib/i18n'

interface LocaleInitializerProps {
  langParam?: string
  serverLocale?: string
}

/**
 * Initialisiert die Locale aus URL-Parametern synchron beim ersten Render
 * 
 * WICHTIG: Diese Komponente sollte so früh wie möglich im Component Tree gerendert werden,
 * damit die Locale verfügbar ist, bevor andere Komponenten Übersetzungen verwenden.
 */
export function LocaleInitializer({ langParam, serverLocale }: LocaleInitializerProps) {
  const currentLocale = useAtomValue(localeAtom)
  const setLocale = useSetAtom(localeAtom)
  const hasInitialized = useRef(false)

  // OPTIMIERUNG: useLayoutEffect für synchrones Setzen vor Paint
  // Das verhindert Hydration-Mismatches, da die Locale vor dem Paint gesetzt wird
  useLayoutEffect(() => {
    if (hasInitialized.current) return
    
    // OPTIMIERUNG: Verwende serverLocale wenn verfügbar (verhindert Hydration-Mismatch)
    // Falls nicht verfügbar, ermittle Locale client-seitig
    let newLocale: Locale
    
    if (serverLocale) {
      // Verwende server-seitig ermittelte Locale (verhindert Mismatch)
      newLocale = serverLocale as Locale
    } else {
      // Fallback: Client-seitige Ermittlung
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('locale='))
        ?.split('=')[1]
      
      const searchParams = langParam ? new URLSearchParams({ lang: langParam }) : undefined
      
      newLocale = getLocale(
        searchParams?.toString(),
        cookieValue,
        navigator.language
      ) as Locale
    }
    
    // Setze Locale nur wenn unterschiedlich (verhindert unnötige Re-Renders)
    if (newLocale !== currentLocale) {
      setLocale(newLocale)
    }
    
    hasInitialized.current = true
    // Leeres Dependency-Array beabsichtigt: Nur beim ersten Mount ausführen
    // currentLocale, langParam, serverLocale und setLocale werden absichtlich nicht als Dependencies verwendet,
    // da dieser Effect nur beim ersten Mount ausgeführt werden soll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reagiere auf Änderungen der langParam (z.B. wenn User navigiert)
  useLayoutEffect(() => {
    if (!hasInitialized.current) return // Skip beim ersten Mount (wird oben behandelt)
    
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    
    const searchParams = langParam ? new URLSearchParams({ lang: langParam }) : undefined
    
    const newLocale = getLocale(
      searchParams?.toString(),
      cookieValue,
      navigator.language
    ) as Locale
    
    if (newLocale !== currentLocale) {
      setLocale(newLocale)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // serverLocale wird absichtlich nicht als Dependency verwendet, da es nur beim ersten Mount verfügbar ist
  }, [langParam, setLocale, currentLocale])

  return null
}

