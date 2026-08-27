/**
 * @fileoverview i18n Atom - Locale State Management
 * 
 * @description
 * Jotai Atom für die UI-Sprache (Locale). Diese Sprache wird vom Benutzer
 * im Hauptmenü ausgewählt und ist NICHT in MongoDB gespeichert.
 * 
 * @module i18n
 * 
 * @exports
 * - localeAtom: Atom für die aktuelle UI-Sprache
 */

import { atom } from 'jotai'
import { getLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n'

/**
 * Ermittelt die initiale Locale aus URL-Parametern, Cookie oder Browser-Sprache
 * Wird nur client-seitig aufgerufen
 * 
 * WICHTIG: URL-Parameter haben höchste Priorität, um Flackern zu vermeiden
 */
function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    // Lese URL-Parameter synchron (höchste Priorität)
    const urlParams = new URLSearchParams(window.location.search)
    
    // Lese Cookie
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    
    // Verwende getLocale mit URL-Parameter als Priorität
    return getLocale(urlParams.toString(), cookieValue, navigator.language)
  } catch {
    return DEFAULT_LOCALE
  }
}

/**
 * Atom für die aktuelle UI-Sprache (Locale)
 * 
 * Diese Sprache wird vom Benutzer im Hauptmenü ausgewählt
 * und ist NICHT in MongoDB gespeichert.
 */
export const localeAtom = atom<Locale>(getInitialLocale())
localeAtom.debugLabel = 'localeAtom'

