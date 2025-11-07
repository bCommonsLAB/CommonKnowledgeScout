/**
 * Server-side i18n Utilities
 * 
 * Hilfsfunktionen für Server Components und API Routes
 */

import { cookies, headers } from 'next/headers'
import { getLocale, getTranslations, t, type Locale } from './index'

/**
 * Ermittelt die aktuelle Sprache in Server Components
 * 
 * @returns Die aktuelle Sprache
 */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const headersList = await headers()
  
  const cookieValue = cookieStore.get('locale')?.value
  const acceptLanguage = headersList.get('accept-language') || undefined
  
  // In Server Components haben wir keinen direkten Zugriff auf searchParams
  // Diese werden in der Page-Komponente verarbeitet
  return getLocale(undefined, cookieValue, acceptLanguage)
}

/**
 * Lädt Übersetzungen für Server Components
 * 
 * @param locale - Die Sprache (optional, wird automatisch ermittelt wenn nicht angegeben)
 * @returns Übersetzungsobjekt
 */
export async function getServerTranslations(locale?: Locale) {
  const currentLocale = locale || await getServerLocale()
  return getTranslations(currentLocale)
}

/**
 * Übersetzt einen Schlüssel in Server Components
 * 
 * @param key - Der Übersetzungsschlüssel
 * @param params - Optionale Parameter
 * @param locale - Die Sprache (optional)
 * @returns Die übersetzte Zeichenkette
 */
export async function serverT(
  key: string,
  params?: Record<string, string | number>,
  locale?: Locale
): Promise<string> {
  const currentLocale = locale || await getServerLocale()
  return t(currentLocale, key, params)
}

