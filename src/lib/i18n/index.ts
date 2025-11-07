/**
 * i18n Utility Library
 * 
 * Einfache, JSON-basierte Internationalisierung für 5 Sprachen:
 * - Deutsch (de)
 * - Italienisch (it)
 * - Englisch (en) - Standard
 * - Französisch (fr)
 * - Spanisch (es)
 */

import deTranslations from './translations/de.json'
import itTranslations from './translations/it.json'
import enTranslations from './translations/en.json'
import frTranslations from './translations/fr.json'
import esTranslations from './translations/es.json'

// Unterstützte Sprachen
export const SUPPORTED_LOCALES = ['de', 'it', 'en', 'fr', 'es'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

// Standard-Sprache ist Englisch
export const DEFAULT_LOCALE: Locale = 'en'

// Übersetzungsdaten
const translations: Record<Locale, typeof enTranslations> = {
  de: deTranslations,
  it: itTranslations,
  en: enTranslations,
  fr: frTranslations,
  es: esTranslations,
}

/**
 * Lädt Übersetzungen für eine bestimmte Sprache
 * Fallback auf Standard-Sprache wenn Sprache nicht unterstützt wird
 */
export function getTranslations(locale: string): typeof enTranslations {
  const normalizedLocale = normalizeLocale(locale)
  return translations[normalizedLocale] || translations[DEFAULT_LOCALE]
}

/**
 * Normalisiert einen Locale-String zu einem unterstützten Locale
 */
function normalizeLocale(locale: string): Locale {
  const lower = locale.toLowerCase()
  // Unterstütze sowohl 'de-DE' als auch 'de'
  const lang = lower.split('-')[0]
  if (SUPPORTED_LOCALES.includes(lang as Locale)) {
    return lang as Locale
  }
  return DEFAULT_LOCALE
}

/**
 * Übersetzt einen Schlüssel mit optionalen Parametern
 * 
 * @param locale - Die aktuelle Sprache
 * @param key - Der Übersetzungsschlüssel (z.B. 'home.hero.title')
 * @param params - Optionale Parameter für Platzhalter (z.B. {name: 'John'})
 * @returns Die übersetzte Zeichenkette
 */
export function t(
  locale: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const translations = getTranslations(locale)
  const keys = key.split('.')
  
  // Navigiere durch das verschachtelte Objekt
  let value: unknown = translations
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      // Fallback: Versuche deutschen Text wenn Schlüssel nicht gefunden
      const deValue = getNestedValue(deTranslations, keys)
      if (deValue && typeof deValue === 'string') {
        return replaceParams(deValue, params)
      }
      // Letzter Fallback: Schlüssel selbst
      return key
    }
  }
  
  if (typeof value === 'string') {
    return replaceParams(value, params)
  }
  
  // Fallback auf deutschen Text
  const deValue = getNestedValue(deTranslations, keys)
  if (deValue && typeof deValue === 'string') {
    return replaceParams(deValue, params)
  }
  
  return key
}

/**
 * Hilfsfunktion zum Abrufen eines verschachtelten Wertes
 */
function getNestedValue(obj: unknown, keys: string[]): unknown {
  let value: unknown = obj
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return undefined
    }
  }
  return value
}

/**
 * Ersetzt Platzhalter in einem String (z.B. {name} -> 'John')
 */
function replaceParams(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text
  
  let result = text
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

/**
 * Ermittelt die aktuelle Sprache aus verschiedenen Quellen
 * Priorität: URL-Parameter > Cookie > Browser-Sprache > Standard
 * 
 * @param searchParams - URL-Suchparameter (z.B. ?lang=de)
 * @param cookieValue - Cookie-Wert für Sprache
 * @param acceptLanguage - Accept-Language Header vom Browser
 * @returns Die ermittelte Sprache
 */
export function getLocale(
  searchParams?: URLSearchParams | string,
  cookieValue?: string,
  acceptLanguage?: string
): Locale {
  // 1. URL-Parameter hat höchste Priorität
  if (searchParams) {
    const params = typeof searchParams === 'string' 
      ? new URLSearchParams(searchParams)
      : searchParams
    const langParam = params.get('lang')
    if (langParam) {
      const normalized = normalizeLocale(langParam)
      if (SUPPORTED_LOCALES.includes(normalized)) {
        return normalized
      }
    }
  }
  
  // 2. Cookie-Wert
  if (cookieValue) {
    const normalized = normalizeLocale(cookieValue)
    if (SUPPORTED_LOCALES.includes(normalized)) {
      return normalized
    }
  }
  
  // 3. Browser-Sprache
  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim())
    
    for (const lang of languages) {
      const normalized = normalizeLocale(lang)
      if (SUPPORTED_LOCALES.includes(normalized)) {
        return normalized
      }
    }
  }
  
  // 4. Standard
  return DEFAULT_LOCALE
}

